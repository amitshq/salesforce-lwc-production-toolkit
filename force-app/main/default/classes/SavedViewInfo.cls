/**
 * One saved view as returned by SavedViewService. `config` is the JSON the
 * datatable wrote when the view was saved; the server checks that it is a
 * JSON object but otherwise treats it as opaque.
 */
public with sharing class SavedViewInfo {
    @AuraEnabled public Id id;
    @AuraEnabled public String name;
    @AuraEnabled public String config;
    @AuraEnabled public Boolean isDefault = false;
}
