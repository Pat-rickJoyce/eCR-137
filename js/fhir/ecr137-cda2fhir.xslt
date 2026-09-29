<?xml version="1.0" encoding="UTF-8"?>
<!--
  eCR-137 CDA to FHIR entry point.
  Imports the upstream lantanagroup/eCRTransforms cda2fhir-r4 transform unchanged and adds:
    ecr137-pre   normalization of the in-memory CDA copy before conversion
    ecr137-post  eCR-137 conversion rules applied to the FHIR Bundle
  and a fast UUID function.
-->
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns="http://hl7.org/fhir"
  xmlns:fhir="http://hl7.org/fhir"
  xmlns:cda="urn:hl7-org:v3"
  xmlns:uuid="http://www.uuid.org"
  xmlns:e137="urn:ecr137"
  xmlns:math="http://www.w3.org/2005/xpath-functions/math"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="fhir cda uuid e137 math xs">

  <xsl:import href="../cda2fhir-r4/NativeUUIDGen-cda2fhir.xslt"/>

  <xsl:output method="xml" indent="yes" encoding="UTF-8"/>

  <xsl:param name="pSeed" select="string(current-dateTime())"/>

  <!-- ===== Fast UUID (replaces the native timestamp UUID, 48 s to under 1 s per eICR) ===== -->
  <xsl:function name="e137:hex8" as="xs:string">
    <xsl:param name="n" as="xs:double"/>
    <xsl:variable name="i" select="xs:integer(floor($n * 4294967296))"/>
    <xsl:sequence select="string-join(for $k in reverse(0 to 7) return substring('0123456789abcdef', 1 + ($i idiv xs:integer(math:pow(16, $k))) mod 16, 1), '')"/>
  </xsl:function>
  <xsl:function name="uuid:get-uuid" as="xs:string*">
    <xsl:param name="node"/>
    <xsl:variable name="r1" select="random-number-generator(concat($pSeed, generate-id($node)))"/>
    <xsl:variable name="r2" select="$r1?next()"/>
    <xsl:variable name="r3" select="$r2?next()"/>
    <xsl:variable name="r4" select="$r3?next()"/>
    <xsl:variable name="h" select="concat(e137:hex8($r1?number), e137:hex8($r2?number), e137:hex8($r3?number), e137:hex8($r4?number))"/>
    <xsl:sequence select="concat(substring($h,1,8),'-',substring($h,9,4),'-4',substring($h,14,3),'-a',substring($h,18,3),'-',substring($h,21,12))"/>
  </xsl:function>

  <!-- ===== Entry point ===== -->
  <xsl:template match="/">
    <xsl:variable name="vNormalized"><xsl:apply-templates select="." mode="ecr137-pre"/></xsl:variable>
    <xsl:variable name="vPrePre"><xsl:apply-templates select="$vNormalized" mode="add-uuids"/></xsl:variable>
    <xsl:variable name="vPre"><xsl:apply-templates select="$vPrePre" mode="update-referenced-actor-uuids"/></xsl:variable>
    <xsl:variable name="vFhir"><xsl:apply-templates select="$vPre" mode="convert"/></xsl:variable>
    <xsl:apply-templates select="$vFhir" mode="ecr137-post"/>
  </xsl:template>

  <!-- ===== ecr137-pre: CDA normalization (in-memory copy only) ===== -->
  <xsl:mode name="ecr137-pre" on-no-match="shallow-copy"/>

  <!-- Specimen Collection Procedure as a direct section entry: upstream converts 22.4.415 only inside a
       Result Organizer. Declare Procedure Activity Procedure as well so it converts as eicr-procedure. -->
  <xsl:template match="cda:section/cda:entry/cda:procedure[cda:templateId/@root = '2.16.840.1.113883.10.20.22.4.415'][not(cda:templateId/@root = '2.16.840.1.113883.10.20.22.4.14')]" mode="ecr137-pre">
    <xsl:copy>
      <xsl:apply-templates select="@*" mode="ecr137-pre"/>
      <cda:templateId root="2.16.840.1.113883.10.20.22.4.14" extension="2014-06-09"/>
      <xsl:apply-templates select="node()" mode="ecr137-pre"/>
    </xsl:copy>
  </xsl:template>

  <!-- ===== ecr137-post: FHIR rules ===== -->
  <xsl:mode name="ecr137-post" on-no-match="shallow-copy"/>

  <xsl:variable name="vRoleCodeDisplay" as="map(xs:string, xs:string)"
    select="map{ 'OF':'Outpatient facility', 'HOSP':'Hospital', 'COMM':'Community Location', 'PROFF':'Provider''s Office' }"/>

  <!-- Composition sections: one section per LOINC code. Entries and narrative of later same-code sections merge into the first. -->
  <xsl:template match="fhir:Composition/fhir:section" mode="ecr137-post">
    <xsl:variable name="vCode" select="fhir:code/fhir:coding[1]/fhir:code/@value"/>
    <xsl:variable name="vSame" select="../fhir:section[fhir:code/fhir:coding[1]/fhir:code/@value = $vCode]"/>
    <xsl:if test="not(preceding-sibling::fhir:section[fhir:code/fhir:coding[1]/fhir:code/@value = $vCode])">
      <xsl:copy>
        <xsl:apply-templates select="@*" mode="ecr137-post"/>
        <xsl:for-each select="*">
          <xsl:choose>
            <xsl:when test="self::fhir:text and count($vSame) gt 1">
              <text>
                <status value="generated"/>
                <div xmlns="http://www.w3.org/1999/xhtml">
                  <xsl:for-each select="$vSame/fhir:text/*:div">
                    <xsl:copy-of select="node()"/>
                  </xsl:for-each>
                </div>
              </text>
            </xsl:when>
            <xsl:when test="self::fhir:entry and count($vSame) gt 1">
              <xsl:if test="not(preceding-sibling::fhir:entry)">
                <xsl:for-each select="$vSame/fhir:entry">
                  <xsl:apply-templates select="." mode="ecr137-post"/>
                </xsl:for-each>
              </xsl:if>
            </xsl:when>
            <xsl:otherwise><xsl:apply-templates select="." mode="ecr137-post"/></xsl:otherwise>
          </xsl:choose>
        </xsl:for-each>
        <!-- first section had no entries but a later one does -->
        <xsl:if test="count($vSame) gt 1 and not(fhir:entry) and $vSame/fhir:entry">
          <xsl:apply-templates select="$vSame/fhir:entry" mode="ecr137-post"/>
        </xsl:if>
      </xsl:copy>
    </xsl:if>
  </xsl:template>

  <!-- patient-birthTime belongs on Patient.birthDate -->
  <xsl:template match="fhir:Patient/fhir:extension[@url = 'http://hl7.org/fhir/StructureDefinition/patient-birthTime']" mode="ecr137-post"/>
  <xsl:template match="fhir:Patient/fhir:birthDate" mode="ecr137-post">
    <xsl:copy>
      <xsl:apply-templates select="@*" mode="ecr137-post"/>
      <xsl:copy-of select="../fhir:extension[@url = 'http://hl7.org/fhir/StructureDefinition/patient-birthTime']"/>
      <xsl:apply-templates select="node()" mode="ecr137-post"/>
    </xsl:copy>
  </xsl:template>

  <!-- Blood pressure panel with only one of systolic/diastolic recorded: FHIR bp requires both components;
       the missing one carries dataAbsentReason unknown -->
  <xsl:template match="fhir:Observation[fhir:code/fhir:coding/fhir:code/@value = '85354-9'][count(fhir:component) = 1]/fhir:component" mode="ecr137-post">
    <xsl:variable name="vHave" select="string(fhir:code/fhir:coding[fhir:system/@value = 'http://loinc.org'][1]/fhir:code/@value)"/>
    <xsl:if test="$vHave = '8462-4'"><xsl:sequence select="e137:bp-absent('8480-6', 'Systolic blood pressure')"/></xsl:if>
    <xsl:next-match/>
    <xsl:if test="$vHave = '8480-6'"><xsl:sequence select="e137:bp-absent('8462-4', 'Diastolic blood pressure')"/></xsl:if>
  </xsl:template>
  <xsl:function name="e137:bp-absent">
    <xsl:param name="pCode"/>
    <xsl:param name="pDisplay"/>
    <component>
      <code><coding><system value="http://loinc.org"/><code value="{$pCode}"/><display value="{$pDisplay}"/></coding></code>
      <dataAbsentReason><coding><system value="http://terminology.hl7.org/CodeSystem/data-absent-reason"/><code value="unknown"/><display value="Unknown"/></coding></dataAbsentReason>
    </component>
  </xsl:function>

  <!-- Oxygen saturation: FHIR core oxygensat requires LOINC 2708-6 -->
  <xsl:template match="fhir:Observation/fhir:code[fhir:coding[fhir:system/@value = 'http://loinc.org'][fhir:code/@value = '59408-5']][not(fhir:coding[fhir:code/@value = '2708-6'])]" mode="ecr137-post">
    <xsl:copy>
      <coding>
        <system value="http://loinc.org"/>
        <code value="2708-6"/>
        <display value="Oxygen saturation in Arterial blood"/>
      </coding>
      <xsl:apply-templates select="node()" mode="ecr137-post"/>
    </xsl:copy>
  </xsl:template>

  <!-- instant elements: date precision padded to midnight UTC -->
  <xsl:template match="fhir:issued/@value | fhir:Bundle/fhir:timestamp/@value | fhir:meta/fhir:lastUpdated/@value | fhir:Provenance/fhir:recorded/@value" mode="ecr137-post">
    <xsl:attribute name="value">
      <xsl:choose>
        <xsl:when test="matches(., '^\d{4}-\d{2}-\d{2}$')"><xsl:value-of select="concat(., 'T00:00:00Z')"/></xsl:when>
        <xsl:when test="matches(., '^\d{4}-\d{2}$')"><xsl:value-of select="concat(., '-01T00:00:00Z')"/></xsl:when>
        <xsl:when test="matches(., '^\d{4}$')"><xsl:value-of select="concat(., '-01-01T00:00:00Z')"/></xsl:when>
        <xsl:otherwise><xsl:value-of select="."/></xsl:otherwise>
      </xsl:choose>
    </xsl:attribute>
  </xsl:template>

  <!-- identifier emitted twice (urn:oid:ROOT + EXT, and RFC 3986 urn:oid:ROOT.EXT): keep the first -->
  <xsl:template match="fhir:identifier[fhir:system/@value = 'urn:ietf:rfc:3986'][starts-with(fhir:value/@value, 'urn:oid:')]" mode="ecr137-post">
    <xsl:variable name="v" select="fhir:value/@value"/>
    <xsl:if test="not(../fhir:identifier[concat(fhir:system/@value, '.', fhir:value/@value) = $v])">
      <xsl:next-match/>
    </xsl:if>
  </xsl:template>

  <!-- duplicate meta.profile -->
  <xsl:template match="fhir:meta/fhir:profile[@value = preceding-sibling::fhir:profile/@value]" mode="ecr137-post"/>

  <!-- upstream template-profile-mapping.xml typo for 22.4.27 -->
  <xsl:template match="fhir:meta/fhir:profile/@value[starts-with(., 'ehttp://')]" mode="ecr137-post">
    <xsl:attribute name="value" select="substring(., 2)"/>
  </xsl:template>

  <!-- CVX: upstream oid-uri-mapping-r4.xml maps CVX from 2.16.840.1.113883.3.13 only -->
  <xsl:template match="fhir:coding/fhir:system/@value[. = 'urn:oid:2.16.840.1.113883.12.292']" mode="ecr137-post">
    <xsl:attribute name="value">http://hl7.org/fhir/sid/cvx</xsl:attribute>
  </xsl:template>

  <!-- v3-RoleCode displays from THO -->
  <xsl:template match="fhir:coding[fhir:system/@value = 'http://terminology.hl7.org/CodeSystem/v3-RoleCode'][map:contains($vRoleCodeDisplay, string(fhir:code/@value))]/fhir:display" mode="ecr137-post" xmlns:map="http://www.w3.org/2005/xpath-functions/map">
    <display value="{$vRoleCodeDisplay(string(../fhir:code/@value))}"/>
  </xsl:template>

  <!-- XHTML inline emphasis in CDA narrative -->
  <xsl:template match="cda:strong | cda:em">
    <xsl:element name="{local-name()}" namespace="http://www.w3.org/1999/xhtml"><xsl:apply-templates/></xsl:element>
  </xsl:template>
  <xsl:template match="cda:strong | cda:em" mode="narrative">
    <xsl:element name="{local-name()}" namespace="http://www.w3.org/1999/xhtml"><xsl:apply-templates select="node()" mode="narrative"/></xsl:element>
  </xsl:template>

  <!-- Empty values: drop empty primitives, scheme-only telecom values, and elements left with no content (ele-1) -->
  <xsl:template match="@value[normalize-space(.) = '']" mode="ecr137-post"/>
  <xsl:template match="fhir:telecom[not(.//fhir:extension)][not(matches(fhir:value/@value, '\S')) or matches(fhir:value/@value, '^(tel|mailto|fax|http|https):/*$')]" mode="ecr137-post"/>
  <xsl:template match="fhir:*[not(self::fhir:Bundle)][not(parent::fhir:resource)][not(descendant-or-self::*/@value[normalize-space(.) != ''])][not(descendant-or-self::*/@url)][not(descendant::*:div)][not(self::*:div)]" mode="ecr137-post" priority="-0.25"/>
  <!-- us-ph-patient requires race and ethnicity: absent in the source means unknown -->
  <xsl:template match="fhir:Patient[fhir:meta/fhir:profile/@value = 'http://hl7.org/fhir/us/ecr/StructureDefinition/us-ph-patient']" mode="ecr137-post">
    <xsl:copy>
      <xsl:apply-templates select="fhir:id | fhir:meta | fhir:implicitRules | fhir:language | fhir:text | fhir:contained | fhir:extension" mode="ecr137-post"/>
      <xsl:for-each select="('race', 'ethnicity')[not(concat('http://hl7.org/fhir/us/core/StructureDefinition/us-core-', .) = current()/fhir:extension/@url)]">
        <extension url="http://hl7.org/fhir/us/core/StructureDefinition/us-core-{.}">
          <xsl:if test=". = 'race'">
            <extension url="ombCategory">
              <valueCoding>
                <system value="http://terminology.hl7.org/CodeSystem/v3-NullFlavor"/>
                <code value="UNK"/>
                <display value="Unknown"/>
              </valueCoding>
            </extension>
          </xsl:if>
          <extension url="text"><valueString value="Unknown"/></extension>
        </extension>
      </xsl:for-each>
      <xsl:apply-templates select="* except (fhir:id | fhir:meta | fhir:implicitRules | fhir:language | fhir:text | fhir:contained | fhir:extension)" mode="ecr137-post"/>
    </xsl:copy>
  </xsl:template>

  <!-- eicr-encounter requires type and location -->
  <xsl:template match="fhir:Encounter[fhir:meta/fhir:profile/@value = 'http://hl7.org/fhir/us/ecr/StructureDefinition/eicr-encounter'][not(fhir:type) or not(fhir:location)]" mode="ecr137-post">
    <xsl:variable name="vAfterType" select="fhir:serviceType | fhir:priority | fhir:subject | fhir:episodeOfCare | fhir:basedOn | fhir:participant | fhir:appointment | fhir:period | fhir:length | fhir:reasonCode | fhir:reasonReference | fhir:diagnosis | fhir:account | fhir:hospitalization | fhir:location | fhir:serviceProvider | fhir:partOf"/>
    <xsl:variable name="vAfterLocation" select="fhir:serviceProvider | fhir:partOf"/>
    <xsl:copy>
      <xsl:apply-templates select="* except ($vAfterType, fhir:type)" mode="ecr137-post"/>
      <xsl:apply-templates select="fhir:type" mode="ecr137-post"/>
      <xsl:if test="not(fhir:type)">
        <type><extension url="http://hl7.org/fhir/StructureDefinition/data-absent-reason"><valueCode value="unknown"/></extension></type>
      </xsl:if>
      <xsl:apply-templates select="$vAfterType except $vAfterLocation" mode="ecr137-post"/>
      <xsl:if test="not(fhir:location)">
        <location><location><extension url="http://hl7.org/fhir/StructureDefinition/data-absent-reason"><valueCode value="unknown"/></extension></location></location>
      </xsl:if>
      <xsl:apply-templates select="$vAfterLocation" mode="ecr137-post"/>
    </xsl:copy>
  </xsl:template>
  <!-- us-ph-travel-history requires effective[x]: an empty source period is unknown -->
  <xsl:template match="fhir:Observation[fhir:meta/fhir:profile/@value = 'http://hl7.org/fhir/us/ecr/StructureDefinition/us-ph-travel-history']/fhir:effectivePeriod[not(*/@value[normalize-space(.) != ''])]" mode="ecr137-post">
    <effectiveDateTime><extension url="http://hl7.org/fhir/StructureDefinition/data-absent-reason"><valueCode value="unknown"/></extension></effectiveDateTime>
  </xsl:template>
</xsl:stylesheet>
