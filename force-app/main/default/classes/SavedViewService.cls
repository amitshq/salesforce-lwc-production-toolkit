/**
 * Per-user saved views for toolkit datatables: a named bundle of visible
 * columns, sort, search and filters, stored in ToolkitSavedView__c and
 * identified by a free-form view key (the `view-key` set on the table).
 *
 * Security model:
 *  - ToolkitSavedView__c is Private, and every query here also filters on
 *    OwnerId = the running user. Admins with "View All Data" bypass sharing,
 *    so the explicit filter is what keeps one user's views away from another.
 *  - All reads and DML run in user mode, so object and field permissions
 *    apply (the LWCToolkitAdmin permission set grants them).
 *  - The config is stored, never executed. It is only checked to be a JSON
 *    object of a sane size; the datatable validates it against its own
 *    columns when applying it.
 *
 * A user has at most one default view per view key. Saving or setting a
 * default clears the previous one in the same transaction; two simultaneous
 * saves from two browser tabs could still leave two defaults, in which case
 * the datatable simply applies the first it finds.
 */
public with sharing class SavedViewService {
    private static final Integer MAX_NAME_LENGTH = 80;
    private static final Integer MAX_KEY_LENGTH = 255;
    private static final Integer MAX_CONFIG_LENGTH = 30000;
    private static final Integer MAX_VIEWS_PER_KEY = 50;

    public class SavedViewException extends Exception {
    }

    /** The running user's views for a table, ordered by name. */
    @AuraEnabled
    public static List<SavedViewInfo> getViews(String viewKey) {
        try {
            return toInfos(queryViews(requireViewKey(viewKey)));
        } catch (SavedViewException sve) {
            throw toAuraException(sve.getMessage());
        } catch (Exception e) {
            throw toAuraException('Unable to load saved views: ' + e.getMessage());
        }
    }

    /**
     * Creates a view, or replaces one. With a viewId that view is updated (and may be
     * renamed); without one, a view with the same name is replaced, else a new one is
     * created. makeDefault null leaves the default flag as it is.
     */
    @AuraEnabled
    public static SavedViewInfo saveView(
        String viewKey,
        String objectApiName,
        String name,
        String config,
        Boolean makeDefault,
        Id viewId
    ) {
        try {
            String key = requireViewKey(viewKey);
            String cleanName = requireName(name);
            requireValidConfig(config);
            if (objectApiName != null && objectApiName.length() > MAX_NAME_LENGTH) {
                throw new SavedViewException('The object API name is too long.');
            }

            List<ToolkitSavedView__c> mine = queryViews(key);
            ToolkitSavedView__c target = findTarget(mine, viewId, cleanName);
            if (viewId != null && target == null) {
                throw new SavedViewException('That view no longer exists. Save it as a new view instead.');
            }
            for (ToolkitSavedView__c other : mine) {
                if (other.Id != (target == null ? null : target.Id) && other.Name.equalsIgnoreCase(cleanName)) {
                    throw new SavedViewException('You already have a view named "' + cleanName + '".');
                }
            }
            if (target == null) {
                if (mine.size() >= MAX_VIEWS_PER_KEY) {
                    throw new SavedViewException('You can keep at most ' + MAX_VIEWS_PER_KEY + ' views per table. Delete one first.');
                }
                target = new ToolkitSavedView__c(ViewKey__c = key, ObjectApiName__c = objectApiName, IsDefault__c = false);
            }
            target.Name = cleanName;
            target.Config__c = config;
            if (makeDefault != null) {
                target.IsDefault__c = makeDefault;
            }

            if (target.IsDefault__c == true) {
                clearDefaults(mine, target.Id);
            }
            if (target.Id == null) {
                insert as user target;
            } else {
                update as user target;
            }
            return toInfo(target);
        } catch (SavedViewException sve) {
            throw toAuraException(sve.getMessage());
        } catch (Exception e) {
            throw toAuraException('Unable to save the view: ' + e.getMessage());
        }
    }

    /** Makes viewId the default for the table; a null viewId clears the default. Returns the refreshed list. */
    @AuraEnabled
    public static List<SavedViewInfo> setDefaultView(String viewKey, Id viewId) {
        try {
            List<ToolkitSavedView__c> mine = queryViews(requireViewKey(viewKey));
            Boolean found = (viewId == null);
            List<ToolkitSavedView__c> changed = new List<ToolkitSavedView__c>();
            for (ToolkitSavedView__c view : mine) {
                Boolean shouldBeDefault = (viewId != null && view.Id == viewId);
                found = found || shouldBeDefault;
                if ((view.IsDefault__c == true) != shouldBeDefault) {
                    view.IsDefault__c = shouldBeDefault;
                    changed.add(view);
                }
            }
            if (!found) {
                throw new SavedViewException('That view no longer exists.');
            }
            if (!changed.isEmpty()) {
                update as user changed;
            }
            return toInfos(mine);
        } catch (SavedViewException sve) {
            throw toAuraException(sve.getMessage());
        } catch (Exception e) {
            throw toAuraException('Unable to change the default view: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteView(Id viewId) {
        try {
            Id userId = UserInfo.getUserId();
            List<ToolkitSavedView__c> rows = [
                SELECT Id
                FROM ToolkitSavedView__c
                WHERE Id = :viewId AND OwnerId = :userId
                WITH USER_MODE
                LIMIT 1
            ];
            if (rows.isEmpty()) {
                throw new SavedViewException('That view no longer exists.');
            }
            delete as user rows;
        } catch (SavedViewException sve) {
            throw toAuraException(sve.getMessage());
        } catch (Exception e) {
            throw toAuraException('Unable to delete the view: ' + e.getMessage());
        }
    }

    private static List<ToolkitSavedView__c> queryViews(String viewKey) {
        Id userId = UserInfo.getUserId();
        return [
            SELECT Id, Name, Config__c, IsDefault__c
            FROM ToolkitSavedView__c
            WHERE ViewKey__c = :viewKey AND OwnerId = :userId
            WITH USER_MODE
            ORDER BY Name
            LIMIT 200
        ];
    }

    private static ToolkitSavedView__c findTarget(List<ToolkitSavedView__c> mine, Id viewId, String cleanName) {
        // An explicit id wins; without one, a view with the same name is the one being replaced.
        for (ToolkitSavedView__c view : mine) {
            Boolean isMatch = (viewId != null) ? (view.Id == viewId) : view.Name.equalsIgnoreCase(cleanName);
            if (isMatch) {
                return view;
            }
        }
        return null;
    }

    private static void clearDefaults(List<ToolkitSavedView__c> mine, Id keepId) {
        List<ToolkitSavedView__c> changed = new List<ToolkitSavedView__c>();
        for (ToolkitSavedView__c view : mine) {
            if (view.IsDefault__c == true && view.Id != keepId) {
                view.IsDefault__c = false;
                changed.add(view);
            }
        }
        if (!changed.isEmpty()) {
            update as user changed;
        }
    }

    private static String requireViewKey(String viewKey) {
        if (String.isBlank(viewKey)) {
            throw new SavedViewException('A view key is required.');
        }
        if (viewKey.trim().length() > MAX_KEY_LENGTH) {
            throw new SavedViewException('The view key is too long.');
        }
        return viewKey.trim();
    }

    private static String requireName(String name) {
        if (String.isBlank(name)) {
            throw new SavedViewException('Give the view a name.');
        }
        String cleanName = name.trim();
        if (cleanName.length() > MAX_NAME_LENGTH) {
            throw new SavedViewException('A view name can be at most ' + MAX_NAME_LENGTH + ' characters.');
        }
        return cleanName;
    }

    private static void requireValidConfig(String config) {
        if (String.isBlank(config)) {
            throw new SavedViewException('A view needs its settings.');
        }
        if (config.length() > MAX_CONFIG_LENGTH) {
            throw new SavedViewException('The view settings are too large to save.');
        }
        Object parsed;
        try {
            parsed = JSON.deserializeUntyped(config);
        } catch (JSONException je) {
            throw new SavedViewException('The view settings are not valid JSON.');
        }
        if (!(parsed instanceof Map<String, Object>)) {
            throw new SavedViewException('The view settings must be a JSON object.');
        }
    }

    private static List<SavedViewInfo> toInfos(List<ToolkitSavedView__c> views) {
        List<SavedViewInfo> infos = new List<SavedViewInfo>();
        for (ToolkitSavedView__c view : views) {
            infos.add(toInfo(view));
        }
        return infos;
    }

    private static SavedViewInfo toInfo(ToolkitSavedView__c view) {
        SavedViewInfo info = new SavedViewInfo();
        info.id = view.Id;
        info.name = view.Name;
        info.config = view.Config__c;
        info.isDefault = view.IsDefault__c == true;
        return info;
    }

    // AuraHandledException hides its message from getMessage() unless setMessage is called.
    private static AuraHandledException toAuraException(String message) {
        AuraHandledException ex = new AuraHandledException(message);
        ex.setMessage(message);
        return ex;
    }
}
