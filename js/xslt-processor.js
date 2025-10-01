/**
 * xslt-processor.js
 *
 * XSLT Transformation and XML Processing Functions
 * Part of the eCR-137 Electronic Case Reporting System
 *
 * This file handles transformation of CDA XML documents to HTML
 * using XSLT stylesheets for human-readable viewing.
 *
 * Dependencies:
 * - Browser XSLTProcessor API
 * - DOMParser API
 *
 * @medical-software CRITICAL - Accurate transformation ensures proper document viewing
 */

/**
 * Fetch Local XSLT File
 * Loads an XSLT stylesheet from the local filesystem
 * @param {string} url - Path to the XSLT file
 * @returns {Promise<string>} XSLT content as string
 */
async function fetchXslt(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load local XSLT file: ${url} (Status: ${res.status})`);
    }
    return res.text();
  } catch (error) {
    console.error(`Failed to fetch XSLT file ${url}:`, error);
    throw new Error(`Cannot load XSLT file: ${url}. Make sure the file exists in your project directory.`);
  }
}

/**
 * Debug XSLT Files
 * Diagnostic function to verify XSLT file integrity
 */
async function debugXsltFiles() {
  try {
    console.log('=== DEBUGGING XSLT FILES ===');

    const eicrXsl = await fetchXslt(EICR_XSL_URL);
    const rrXsl = await fetchXslt(RR_XSL_URL);

    console.log('eICR XSLT length:', eicrXsl.length, 'characters');
    console.log('eICR XSLT starts with:', eicrXsl.substring(0, 200));
    console.log('eICR XSLT contains stylesheet?', eicrXsl.includes('xsl:stylesheet'));

    console.log('RR XSLT length:', rrXsl.length, 'characters');
    console.log('RR XSLT starts with:', rrXsl.substring(0, 200));
    console.log('RR XSLT contains stylesheet?', rrXsl.includes('xsl:stylesheet'));

    // Check if files look like proper XSLT
    if (!eicrXsl.includes('<?xml') || !eicrXsl.includes('xsl:stylesheet')) {
      console.error('eICR XSLT appears to be invalid or corrupted');
    }
    if (!rrXsl.includes('<?xml') || !rrXsl.includes('xsl:stylesheet')) {
      console.error('RR XSLT appears to be invalid or corrupted');
    }

  } catch (error) {
    console.error('Failed to debug XSLT files:', error);
  }
}

/**
 * Debug XML Structure
 * Diagnostic function to verify XML document structure
 * @param {string} xmlString - XML document as string
 * @param {string} docType - Document type for logging (eICR/RR)
 */
function debugXmlStructure(xmlString, docType) {
  console.log(`=== DEBUGGING ${docType} XML ===`);
  console.log('XML length:', xmlString.length);
  console.log('First 500 characters:', xmlString.substring(0, 500));

  // Check for key elements the XSLT might be looking for
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  console.log('Root element:', doc.documentElement?.tagName);
  console.log('Namespace URI:', doc.documentElement?.namespaceURI);

  // Look for common CDA elements
  const commonElements = ['ClinicalDocument', 'component', 'structuredBody', 'section'];
  commonElements.forEach(element => {
    const found = doc.getElementsByTagName(element).length;
    console.log(`${element} elements found:`, found);
  });
}

/**
 * XML to HTML Transformation
 * Transforms CDA XML to HTML using XSLT stylesheet
 *
 * @param {string} xmlString - The CDA XML document
 * @param {string} xsltString - The XSLT stylesheet
 * @returns {string} Transformed HTML document
 * @throws {Error} If transformation fails
 */
function xmlToHtml(xmlString, xsltString) {
  try {
    console.log('Starting XML transformation...');
    console.log('XML length:', xmlString.length);
    console.log('XSLT length:', xsltString.length);

    const parser = new DOMParser();

    // Parse XML
    const xml = parser.parseFromString(xmlString, 'application/xml');
    const xmlParseErrors = xml.getElementsByTagName('parsererror');
    if (xmlParseErrors.length > 0) {
      console.error('XML parsing error:', xmlParseErrors[0].textContent);
      console.log('Full XML content length:', xmlString.length);
      console.log('XML starts with:', xmlString.substring(0, 200));
      console.log('XML around error area:', xmlString.substring(1680, 1700)); // Adjust numbers based on error line
      throw new Error('Invalid XML document');
    }

    // Parse XSLT
    const xsl = parser.parseFromString(xsltString, 'application/xml');
    const xslParseErrors = xsl.getElementsByTagName('parsererror');
    if (xslParseErrors.length > 0) {
      console.error('XSLT parsing error:', xslParseErrors[0].textContent);
      throw new Error('Invalid XSLT stylesheet');
    }

    // Create and configure processor
    const processor = new XSLTProcessor();
    processor.importStylesheet(xsl);

    // Transform
    const resultDocument = processor.transformToDocument(xml);

    // Check if transformation produced anything
    if (!resultDocument || !resultDocument.documentElement) {
      console.error('XSLT transformation produced no output');
      throw new Error('XSLT transformation failed - no output generated');
    }

    // Serialize result
    const serializer = new XMLSerializer();
    const htmlString = '<!DOCTYPE html>\n' + serializer.serializeToString(resultDocument);

    console.log('Transformation successful. Output length:', htmlString.length);
    console.log('Output starts with:', htmlString.substring(0, 200));

    return htmlString;

  } catch (error) {
    console.error('XML to HTML transformation failed:', error);
    throw new Error(`XSLT transformation error: ${error.message}`);
  }
}

/**
 * Transform eICR to HTML
 * Convenience wrapper for transforming eICR documents
 * @param {string} eicrXml - eICR XML document
 * @returns {Promise<string>} HTML representation
 */
async function transformEICRToHTML(eicrXml) {
    const xslt = await fetchXslt(EICR_XSL_URL);
    return xmlToHtml(eicrXml, xslt);
}

/**
 * Transform RR to HTML
 * Convenience wrapper for transforming RR documents
 * @param {string} rrXml - RR XML document
 * @returns {Promise<string>} HTML representation
 */
async function transformRRToHTML(rrXml) {
    const xslt = await fetchXslt(RR_XSL_URL);
    return xmlToHtml(rrXml, xslt);
}

// Expose functions globally for cross-module access
window.fetchXslt = fetchXslt;
window.xmlToHtml = xmlToHtml;
window.debugXmlStructure = debugXmlStructure;
window.transformEICRToHTML = transformEICRToHTML;
window.transformRRToHTML = transformRRToHTML;
