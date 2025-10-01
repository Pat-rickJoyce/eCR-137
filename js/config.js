/**
 * config.js
 *
 * Global configuration, constants, and data storage for the eCR Form Generator
 * Contains XSLT URLs, global data arrays, RCTC metadata, and value set definitions
 */

// Local XSLT files (no CORS issues)
const EICR_XSL_URL = './CDAR2_eCR_eICR-2.xsl';
const RR_XSL_URL   = './CDAR2_eCR_RR.xsl';

// Global variable to store lab observation data
let labObsData = [];
let labObsLoaded = false;

// Global variable to store diagnosis data
let diagnosisData = [];
let diagnosisLoaded = false;

// Global variables for new lab order, organism, and test data
let labOrderData = [];
let labOrderLoaded = false;
let organismData = [];
let organismLoaded = false;
let testData = [];
let testLoaded = false;

// Global RCTC data storage
let rctcData = {
    diagnosis: [],
    labOrder: [],
    labObs: [],
    medications: [],
    organism: [],
    metadata: {
        oid: '2.16.840.1.113762.1.4.1146.2260', // RCTC Birth Defect Trigger Codes OID
        version: '2.0.1',
        effectiveDate: '2025-06-01',
        releaseDate: '2025-03-18'
    }
};

// Global variable to store conditions data
let conditionsData = [];
let conditionsLoaded = false;

// DQ Schematron ValueSets
const DQ_VALUESETS = {
    administrativeGender: {
        oid: '2.16.840.1.113883.5.1',
        values: ['F', 'M', 'UN']
    },
    raceCategory: {
        oid: '2.16.840.1.113883.6.238',
        values: ['1002-5', '2028-9', '2054-5', '2076-8', '2106-3', '2131-1']
    },
    ethnicity: {
        oid: '2.16.840.1.113883.6.238',
        values: ['2135-2', '2186-5']
    },
    specimenType: {
        oid: '2.16.840.1.113883.21.327',
        values: ['258500001', '461911000124106', '258580003', '122555007', '309051001', '119295008', '119297000', '122552005', '168139001', '258467004', '441620008']
    },
    bodySite: {
        oid: '2.16.840.1.113883.3.88.12.3221.8.9',
        values: ['71341001', '123851003', '181216001', '258435002', '272673000', '362837007']
    }
};

// Non-blocking DQ validation errors (still display but don't prevent CDA generation)
const NON_BLOCKING_DQ = new Set([
    'dq-patientName-002/004'
]);
