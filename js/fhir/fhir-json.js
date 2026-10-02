/*
 * FHIR R4 XML to JSON serializer (https://hl7.org/fhir/R4/json.html).
 * Type-driven by window.ECR137_FHIR_R4_TYPES (js/fhir/fhir-r4-json-types.js):
 * arrays by element cardinality, numbers and booleans by primitive type, decimals
 * kept in their exact lexical form, primitive id and extensions in _element
 * (aligned arrays for repeating primitives), choice names kept, nested resources
 * with resourceType, Narrative div as an XHTML string.
 */
(function (root) {
  'use strict';

  const NUMERIC = new Set(['integer', 'positiveInt', 'unsignedInt']);

  function Raw(text) { this.text = text; }

  function typeMap() {
    const map = root.ECR137_FHIR_R4_TYPES;
    if (!map) throw new Error('FHIR R4 type map not loaded (js/fhir/fhir-r4-json-types.js)');
    if (!map._prims) map._prims = new Set(map.primitives);
    return map;
  }

  function elementChildren(node) {
    const out = [];
    for (let c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) out.push(c);
    return out;
  }

  function primitiveValue(type, text) {
    if (type === 'boolean') {
      if (text !== 'true' && text !== 'false') throw new Error(`Invalid boolean "${text}"`);
      return text === 'true';
    }
    if (NUMERIC.has(type)) {
      if (!/^-?\d+$/.test(text)) throw new Error(`Invalid ${type} "${text}"`);
      return Number(text);
    }
    if (type === 'decimal') {
      if (!/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(text)) throw new Error(`Invalid decimal "${text}"`);
      return new Raw(text);
    }
    return text;
  }

  function convertResource(el, map) {
    const out = { resourceType: el.localName };
    if (!map.types[el.localName]) throw new Error(`Unknown resource type ${el.localName}`);
    fill(out, el, el.localName, map, true);
    return out;
  }

  function primitiveExtras(node, map) {
    const extras = {};
    if (node.hasAttribute('id')) extras.id = node.getAttribute('id');
    const exts = elementChildren(node).map(c => {
      if (c.localName !== 'extension') throw new Error(`Unexpected element ${c.localName} in primitive ${node.localName}`);
      const e = {};
      fill(e, c, 'Extension', map, false);
      return e;
    });
    if (exts.length) extras.extension = exts;
    return Object.keys(extras).length ? extras : null;
  }

  function fill(out, el, typeKey, map, isResource) {
    const defs = map.types[typeKey];
    if (!defs) throw new Error(`Unknown type ${typeKey}`);
    if (!isResource) {
      if (el.hasAttribute('id')) out.id = el.getAttribute('id');
      if (typeKey === 'Extension' && el.hasAttribute('url')) out.url = el.getAttribute('url');
    }
    const groups = new Map();
    for (const c of elementChildren(el)) {
      if (!groups.has(c.localName)) groups.set(c.localName, []);
      groups.get(c.localName).push(c);
    }
    for (const [name, nodes] of groups) {
      const def = defs[name];
      if (!def) throw new Error(`Unknown element ${typeKey}.${name}`);
      const isArray = def.endsWith('*');
      const type = isArray ? def.slice(0, -1) : def;
      if (!isArray && nodes.length > 1) throw new Error(`${typeKey}.${name} repeats but has max 1`);
      if (type === 'xhtml') {
        out[name] = serializeXhtml(nodes[0]);
      } else if (map._prims.has(type)) {
        const values = nodes.map(n => (n.hasAttribute('value') ? primitiveValue(type, n.getAttribute('value')) : null));
        const extras = nodes.map(n => primitiveExtras(n, map));
        if (isArray) {
          if (values.some(v => v !== null)) out[name] = values;
          if (extras.some(x => x)) out['_' + name] = extras;
        } else {
          if (values[0] !== null) out[name] = values[0];
          if (extras[0]) out['_' + name] = extras[0];
        }
      } else if (type === 'Resource') {
        const vals = nodes.map(n => {
          const inner = elementChildren(n);
          if (inner.length !== 1) throw new Error(`${typeKey}.${name} must hold one resource`);
          return convertResource(inner[0], map);
        });
        out[name] = isArray ? vals : vals[0];
      } else {
        const vals = nodes.map(n => {
          const o = {};
          fill(o, n, type, map, false);
          return o;
        });
        out[name] = isArray ? vals : vals[0];
      }
    }
  }

  function serializeXhtml(node) {
    const xml = new root.XMLSerializer().serializeToString(node);
    return xml.replace(/\s+xmlns:\w+="http:\/\/hl7\.org\/fhir"/g, '');
  }

  function stringify(v, indent) {
    const pad = '  '.repeat(indent);
    const padIn = '  '.repeat(indent + 1);
    if (v === null) return 'null';
    if (v instanceof Raw) return v.text;
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      return '[\n' + v.map(x => padIn + stringify(x, indent + 1)).join(',\n') + '\n' + pad + ']';
    }
    if (typeof v === 'object') {
      const keys = Object.keys(v);
      if (!keys.length) return '{}';
      return '{\n' + keys.map(k => padIn + JSON.stringify(k) + ': ' + stringify(v[k], indent + 1)).join(',\n') + '\n' + pad + '}';
    }
    return JSON.stringify(v);
  }

  function fhirXmlToJson(xml) {
    const map = typeMap();
    const doc = typeof xml === 'string' ? new root.DOMParser().parseFromString(xml, 'application/xml') : xml;
    const err = doc.getElementsByTagName('parsererror');
    if (err && err.length) throw new Error('FHIR XML parse error: ' + err[0].textContent);
    const el = doc.documentElement;
    if (el.namespaceURI !== 'http://hl7.org/fhir') throw new Error('Root element is not in the FHIR namespace');
    return stringify(convertResource(el, map), 0) + '\n';
  }

  root.ecr137FhirXmlToJson = fhirXmlToJson;
  if (typeof module !== 'undefined' && module.exports) module.exports = { fhirXmlToJson };
})(typeof window !== 'undefined' ? window : globalThis);
