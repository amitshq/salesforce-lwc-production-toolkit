import { LightningElement, api } from 'lwc';
import { getMetadataRecordByDeveloperName } from 'c/metadataUtils';

/**
 * Feature-flag gate driven entirely by Custom Metadata - flip a feature on
 * or off per org/sandbox by editing a metadata record, no deployment. Works
 * against any __mdt type with a boolean field, not a hardcoded one.
 *
 * @example
 * <c-feature-gate metadata-api-name="ToolkitDemoSetting__mdt" developer-name="Default" flag-field="IsEnabled__c">
 *     <c-enterprise-datatable-demo></c-enterprise-datatable-demo>
 *     <div slot="disabled">This feature is temporarily unavailable.</div>
 * </c-feature-gate>
 */
export default class FeatureGate extends LightningElement {
    @api metadataApiName;
    @api developerName;
    @api flagField = 'IsEnabled__c';
    @api invert = false;

    isLoading = true;
    isEnabled = false;

    connectedCallback() {
        if (!this.metadataApiName || !this.developerName) {
            this.isLoading = false;
            this.isEnabled = false;
            return;
        }
        getMetadataRecordByDeveloperName(this.metadataApiName, this.developerName, [this.flagField])
            .then((record) => {
                const flagValue = !!(record && record[this.flagField]);
                this.isEnabled = this.invert ? !flagValue : flagValue;
            })
            .catch(() => {
                this.isEnabled = false;
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    get showEnabled() {
        return !this.isLoading && this.isEnabled;
    }

    get showDisabled() {
        return !this.isLoading && !this.isEnabled;
    }
}
