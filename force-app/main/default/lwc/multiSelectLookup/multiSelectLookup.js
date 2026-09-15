import { LightningElement, api } from 'lwc';
import queryRecords from '@salesforce/apex/GenericQueryService.query';
import { debounce } from 'c/functionUtils';
import { reduceApexErrors } from 'c/apexErrorUtils';

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Generic multi-select lookup: type to search any object (via
 * GenericQueryService, so no bespoke Apex controller), pick multiple
 * records, remove them individually. Selected records render as pills.
 *
 * @example
 * <c-multi-select-lookup
 *     label="Contacts"
 *     object-api-name="Contact"
 *     label-field="Name"
 *     search-fields={searchFields}
 *     selected-records={selectedContacts}
 *     onchange={handleContactsChange}
 * ></c-multi-select-lookup>
 *
 * // searchFields = ['Name', 'Email']
 * // handleContactsChange(event) { this.selectedContacts = event.detail.value; }
 */
export default class MultiSelectLookup extends LightningElement {
    @api label = 'Search';
    @api placeholder = 'Search...';
    @api objectApiName;
    @api labelField = 'Name';
    @api searchFields = [];
    @api staticFilters = [];
    @api minSearchLength = 2;
    @api pageSize = 10;
    @api disabled = false;
    @api required = false;

    @api
    get selectedRecords() {
        return this._selectedRecords;
    }
    set selectedRecords(value) {
        this._selectedRecords = Array.isArray(value) ? value : [];
    }

    _selectedRecords = [];
    searchTerm = '';
    results = [];
    isSearching = false;
    isDropdownOpen = false;
    errorMessage = '';
    highlightedIndex = -1;

    _debouncedSearch = debounce(() => this.runSearch(), SEARCH_DEBOUNCE_MS);

    get effectiveSearchFields() {
        return this.searchFields && this.searchFields.length ? this.searchFields : [this.labelField];
    }

    get visibleResults() {
        const selectedIds = new Set(this._selectedRecords.map((r) => r.id));
        return this.results
            .filter((r) => !selectedIds.has(r.id))
            .map((r, index) => ({
                ...r,
                itemClass:
                    index === this.highlightedIndex
                        ? 'slds-media slds-listbox__option slds-listbox__option_plain slds-has-focus'
                        : 'slds-media slds-listbox__option slds-listbox__option_plain'
            }));
    }

    get hasResults() {
        return this.isDropdownOpen && this.visibleResults.length > 0;
    }

    get showNoResults() {
        return this.isDropdownOpen && !this.isSearching && this.searchTerm.length >= this.minSearchLength && this.visibleResults.length === 0;
    }

    get hasSelection() {
        return this._selectedRecords.length > 0;
    }

    handleInputChange(event) {
        this.searchTerm = event.target.value;
        this.highlightedIndex = -1;
        if (this.searchTerm.length >= this.minSearchLength) {
            this.isDropdownOpen = true;
            this.isSearching = true;
            this._debouncedSearch();
        } else {
            this.isDropdownOpen = false;
            this.results = [];
        }
    }

    runSearch() {
        this.errorMessage = '';
        queryRecords({
            objectApiName: this.objectApiName,
            fields: [this.labelField],
            filters: this.staticFilters,
            sortField: this.labelField,
            sortDirection: 'asc',
            searchTerm: this.searchTerm,
            searchFields: this.effectiveSearchFields,
            pageNumber: 1,
            pageSize: this.pageSize
        })
            .then((result) => {
                this.results = (result.records || []).map((record) => ({
                    id: record.Id,
                    label: record[this.labelField]
                }));
            })
            .catch((error) => {
                this.errorMessage = reduceApexErrors(error).join(' ');
                this.results = [];
            })
            .finally(() => {
                this.isSearching = false;
            });
    }

    handleResultClick(event) {
        const id = event.currentTarget.dataset.id;
        this.selectResult(id);
    }

    selectResult(id) {
        const record = this.results.find((r) => r.id === id);
        if (!record) return;
        this._selectedRecords = [...this._selectedRecords, record];
        this.searchTerm = '';
        this.results = [];
        this.isDropdownOpen = false;
        this.highlightedIndex = -1;
        this.notifyChange();
        const input = this.template.querySelector('input');
        if (input) input.focus();
    }

    handleRemove(event) {
        const id = event.currentTarget.dataset.id;
        this._selectedRecords = this._selectedRecords.filter((r) => r.id !== id);
        this.notifyChange();
    }

    handleKeydown(event) {
        const visible = this.visibleResults;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.highlightedIndex = Math.min(this.highlightedIndex + 1, visible.length - 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
        } else if (event.key === 'Enter' && this.highlightedIndex >= 0 && visible[this.highlightedIndex]) {
            event.preventDefault();
            this.selectResult(visible[this.highlightedIndex].id);
        } else if (event.key === 'Escape') {
            this.isDropdownOpen = false;
        }
    }

    handleBlur() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.isDropdownOpen = false;
        }, 150);
    }

    notifyChange() {
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this._selectedRecords } }));
    }
}
