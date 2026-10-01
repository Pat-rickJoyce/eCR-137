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

  <xsl:import href="../../vendor/ecr-transforms/transforms/cda2fhir-r4/NativeUUIDGen-cda2fhir.xslt"/>

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
    <xsl:variable name="vPost"><xsl:apply-templates select="$vFhir" mode="ecr137-post"/></xsl:variable>
    <xsl:variable name="vPerf"><xsl:apply-templates select="$vPost" mode="ecr137-performer"/></xsl:variable>
    <xsl:apply-templates select="$vPerf" mode="ecr137-narrative"/>
  </xsl:template>

  <!-- ===== ecr137-narrative: generated narrative for resources without text (dom-6) ===== -->
  <xsl:mode name="ecr137-narrative" on-no-match="shallow-copy"/>

  <xsl:template match="fhir:entry/fhir:resource/*[not(fhir:text)][not(self::fhir:Bundle)]" mode="ecr137-narrative">
    <xsl:variable name="vHead" select="fhir:id | fhir:meta | fhir:implicitRules | fhir:language"/>
    <xsl:copy>
      <xsl:apply-templates select="@*" mode="ecr137-narrative"/>
      <xsl:apply-templates select="$vHead" mode="ecr137-narrative"/>
      <text>
        <status value="generated"/>
        <div xmlns="http://www.w3.org/1999/xhtml">
          <p><b><xsl:value-of select="local-name()"/></b></p>
          <table>
            <tbody>
              <xsl:for-each-group select="* except ($vHead | fhir:contained | fhir:extension | fhir:modifierExtension)" group-adjacent="local-name()">
                <xsl:variable name="vVals" select="for $e in current-group() return e137:summary($e)"/>
                <xsl:if test="exists($vVals[normalize-space()])">
                  <tr>
                    <th><xsl:value-of select="current-grouping-key()"/></th>
                    <td><xsl:value-of select="string-join(distinct-values($vVals[normalize-space()]), '; ')"/></td>
                  </tr>
                </xsl:if>
              </xsl:for-each-group>
            </tbody>
          </table>
        </div>
      </text>
      <xsl:apply-templates select="* except $vHead" mode="ecr137-narrative"/>
    </xsl:copy>
  </xsl:template>

  <!-- human-readable summary of one element: displays and text first, then values; references and system URIs left out -->
  <xsl:function name="e137:summary" as="xs:string">
    <xsl:param name="e" as="element()"/>
    <xsl:variable name="vDisplay" select="($e/descendant-or-self::fhir:display/@value, $e/descendant-or-self::fhir:text/@value)[normalize-space()]"/>
    <xsl:variable name="vPlain" select="$e/descendant-or-self::*[not(self::fhir:system or self::fhir:reference or self::fhir:url or self::fhir:display or self::fhir:text)][not(ancestor-or-self::fhir:extension)]/@value[normalize-space()]"/>
    <xsl:sequence select="string-join(distinct-values(if (exists($vDisplay)) then $vDisplay else $vPlain), ' ')"/>
  </xsl:function>

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

  <!-- Specimen Collection Procedure (22.4.415), and any procedure whose participant is a Specimen (22.4.410):
       specimen collection is code 17636008 Specimen collection (SNOMED CT) -->
  <xsl:template match="cda:procedure[cda:templateId/@root = '2.16.840.1.113883.10.20.22.4.415' or cda:participant/cda:participantRole/cda:templateId/@root = '2.16.840.1.113883.10.20.22.4.410']/cda:code[not(@code = '17636008' and @codeSystem = '2.16.840.1.113883.6.96')]" mode="ecr137-pre">
    <cda:code code="17636008" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT" displayName="Specimen collection"/>
  </xsl:template>

  <!-- Observation in an entryRelationship of an observation, without its own effectiveTime (Estimated Date of
       Delivery, Gestational Age): the effectiveTime of the observation it belongs to. -->
  <xsl:template match="cda:observation/cda:entryRelationship/cda:observation[not(cda:effectiveTime)][../../cda:effectiveTime]" mode="ecr137-pre">
    <xsl:variable name="vHead" select="cda:realmCode | cda:typeId | cda:templateId | cda:id | cda:code | cda:derivationExpr | cda:text | cda:statusCode"/>
    <xsl:copy>
      <xsl:apply-templates select="@* | $vHead" mode="ecr137-pre"/>
      <xsl:apply-templates select="../../cda:effectiveTime" mode="ecr137-pre"/>
      <xsl:apply-templates select="* except $vHead" mode="ecr137-pre"/>
    </xsl:copy>
  </xsl:template>

  <!-- Narrative IDs repeated in two sections (the same content ID in Medications Administered and Medications):
       each section's IDs and the originalText references inside that section are made unique, so a reference
       resolves to the text of its own section only -->
  <xsl:key name="kNarrativeId" match="cda:*[@ID]" use="@ID"/>
  <xsl:template match="cda:section//cda:*/@ID[count(key('kNarrativeId', .)) gt 1]" mode="ecr137-pre">
    <xsl:attribute name="ID" select="concat(., '-', generate-id(ancestor::cda:section[1]))"/>
  </xsl:template>
  <xsl:template match="cda:section//cda:reference/@value[starts-with(., '#')][count(key('kNarrativeId', substring(., 2))) gt 1]" mode="ecr137-pre">
    <xsl:attribute name="value" select="concat(., '-', generate-id(ancestor::cda:section[1]))"/>
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
        <location><location><extension url="http://hl7.org/fhir/StructureDefinition/data-absent-reason"><valueCode value="unknown"/></extension><display value="Unknown"/></location></location>
      </xsl:if>
      <xsl:apply-templates select="$vAfterLocation" mode="ecr137-post"/>
    </xsl:copy>
  </xsl:template>
  <!-- us-ph-travel-history requires effective[x]: an empty source period is unknown -->
  <xsl:template match="fhir:Observation[fhir:meta/fhir:profile/@value = 'http://hl7.org/fhir/us/ecr/StructureDefinition/us-ph-travel-history']/fhir:effectivePeriod[not(*/@value[normalize-space(.) != ''])]" mode="ecr137-post">
    <effectiveDateTime><extension url="http://hl7.org/fhir/StructureDefinition/data-absent-reason"><valueCode value="unknown"/></extension></effectiveDateTime>
  </xsl:template>
  <!-- ===== ecr137-performer: Observation.performer =====
       In order: the CDA entry author (carried by upstream as Provenance); for a panel (Result Organizer), the
       performers of its members; otherwise the document author, which CDA context conduction makes the author
       of every entry that does not name its own (an authoring device: the organization it represents, Device.owner).
       Only references to resource types Observation.performer allows. -->
  <xsl:mode name="ecr137-performer" on-no-match="shallow-copy"/>
  <xsl:key name="kProvenanceByTarget" match="fhir:Provenance" use="fhir:target/fhir:reference/@value"/>
  <xsl:key name="kEntryByUrl" match="fhir:Bundle/fhir:entry" use="fhir:fullUrl/@value"/>
  <xsl:variable name="vPerformerTypes" select="('Practitioner', 'PractitionerRole', 'Organization', 'CareTeam', 'Patient', 'RelatedPerson')"/>

  <xsl:function name="e137:performer-refs" as="xs:string*">
    <xsl:param name="refs" as="xs:string*"/>
    <xsl:param name="root" as="node()"/>
    <xsl:sequence select="distinct-values($refs[key('kEntryByUrl', ., $root)/fhir:resource/*/local-name() = $vPerformerTypes])"/>
  </xsl:function>

  <xsl:function name="e137:obs-performers" as="xs:string*">
    <xsl:param name="obs" as="element()"/>
    <xsl:param name="depth" as="xs:integer"/>
    <xsl:variable name="vRoot" select="root($obs)"/>
    <xsl:variable name="vOwn" select="e137:performer-refs($obs/fhir:performer/fhir:reference/@value, $vRoot)"/>
    <xsl:variable name="vProv" select="e137:performer-refs(key('kProvenanceByTarget', $obs/../../fhir:fullUrl/@value, $vRoot)/fhir:agent[fhir:type/fhir:coding/fhir:code/@value = 'author']/fhir:who/fhir:reference/@value, $vRoot)"/>
    <xsl:variable name="vMembers" select="if ($depth lt 5) then key('kEntryByUrl', $obs/fhir:hasMember/fhir:reference/@value, $vRoot)/fhir:resource/fhir:Observation else ()"/>
    <xsl:sequence select="if (exists($vOwn)) then $vOwn else if (exists($vProv)) then $vProv
                          else distinct-values(for $m in $vMembers return e137:obs-performers($m, $depth + 1))"/>
  </xsl:function>

  <xsl:template match="fhir:entry/fhir:resource/fhir:Observation[not(fhir:performer)]" mode="ecr137-performer">
    <xsl:variable name="vFound" select="e137:obs-performers(., 0)"/>
    <xsl:variable name="vDocAuthors" select="/fhir:Bundle/fhir:entry/fhir:resource/fhir:Composition/fhir:author/fhir:reference/@value"/>
    <xsl:variable name="vRefs" select="if (exists($vFound)) then $vFound
      else e137:performer-refs(($vDocAuthors, key('kEntryByUrl', $vDocAuthors)/fhir:resource/fhir:Device/fhir:owner/fhir:reference/@value), root(.))"/>
    <xsl:choose>
      <xsl:when test="exists($vRefs)">
        <xsl:variable name="vBefore" select="fhir:id | fhir:meta | fhir:implicitRules | fhir:language | fhir:text | fhir:contained | fhir:extension | fhir:modifierExtension | fhir:identifier | fhir:basedOn | fhir:partOf | fhir:status | fhir:category | fhir:code | fhir:subject | fhir:focus | fhir:encounter | fhir:*[starts-with(local-name(), 'effective')] | fhir:issued"/>
        <xsl:copy>
          <xsl:apply-templates select="@* | $vBefore" mode="ecr137-performer"/>
          <xsl:for-each select="$vRefs">
            <performer><reference value="{.}"/></performer>
          </xsl:for-each>
          <xsl:apply-templates select="* except $vBefore" mode="ecr137-performer"/>
        </xsl:copy>
      </xsl:when>
      <xsl:otherwise><xsl:next-match/></xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <!-- ===== Coded values ===== -->
  <!-- Verified displays (tools/fhir/build-display-table, checked in as display-table.xml, no runtime lookups) -->
  <xsl:param name="pDisplayTable" select="'display-table.xml'"/>
  <xsl:variable name="vDisplayDoc" select="if (doc-available(resolve-uri($pDisplayTable, static-base-uri()))) then doc(resolve-uri($pDisplayTable, static-base-uri())) else ()"/>
  <xsl:key name="kDisplay" match="entry" use="concat(@system, '|', @code)"/>
  <xsl:variable name="vValidatedSystems" select="('http://snomed.info/sct', 'http://loinc.org', 'http://www.nlm.nih.gov/research/umls/rxnorm', 'http://hl7.org/fhir/sid/cvx', 'http://hl7.org/fhir/sid/icd-10-cm', 'http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl', 'http://nucc.org/provider-taxonomy', 'http://www.ama-assn.org/go/cpt', 'urn:iso:std:iso:3166')"/>

  <xsl:function name="e137:is-validated-system" as="xs:boolean">
    <xsl:param name="pSystem" as="xs:string"/>
    <xsl:sequence select="$pSystem = $vValidatedSystems or starts-with($pSystem, 'http://terminology.hl7.org/CodeSystem/')"/>
  </xsl:function>

  <!-- A code that cannot belong to its system: SNOMED and RxNorm codes are digits; any code 'undefined' -->
  <xsl:function name="e137:invalid-code" as="xs:boolean">
    <xsl:param name="c" as="element()"/>
    <xsl:variable name="vSys" select="string($c/fhir:system/@value)"/>
    <xsl:variable name="vCode" select="string($c/fhir:code/@value)"/>
    <xsl:sequence select="$vCode = ('undefined', 'null') or ($vSys = ('http://snomed.info/sct', 'http://www.nlm.nih.gov/research/umls/rxnorm') and not(matches($vCode, '^\d+$')))"/>
  </xsl:function>

  <xsl:template match="fhir:coding[e137:invalid-code(.)][not(parent::*/parent::fhir:Observation and local-name(parent::*) = 'valueCodeableConcept')]" mode="ecr137-post" priority="2"/>

  <!-- Observation value whose only codings are invalid: value[x] carries data-absent-reason (N/A: not-applicable),
       which also satisfies profiles that require value[x] -->
  <xsl:template match="fhir:Observation/fhir:valueCodeableConcept[fhir:coding][every $c in fhir:coding satisfies e137:invalid-code($c)]" mode="ecr137-post" priority="2">
    <valueCodeableConcept>
      <extension url="http://hl7.org/fhir/StructureDefinition/data-absent-reason">
        <valueCode value="{if (fhir:coding/fhir:code/@value = 'N/A') then 'not-applicable' else 'unknown'}"/>
      </extension>
      <xsl:if test="fhir:text or fhir:coding/fhir:display">
        <text value="{(fhir:text/@value, fhir:coding/fhir:display/@value)[1]}"/>
      </xsl:if>
    </valueCodeableConcept>
  </xsl:template>

  <!-- coding.display: verified display from the table; an unverified source display moves to CodeableConcept.text -->
  <xsl:template match="fhir:*[fhir:system][fhir:code][e137:is-validated-system(string(fhir:system/@value))]/fhir:display" mode="ecr137-post" priority="1">
    <xsl:variable name="vKey" select="concat(../fhir:system/@value, '|', ../fhir:code/@value)"/>
    <xsl:variable name="vEntry" select="if ($vDisplayDoc) then key('kDisplay', $vKey, $vDisplayDoc)[1] else ()"/>
    <xsl:choose>
      <xsl:when test="$vEntry/@display"><display value="{$vEntry/@display}"/></xsl:when>
      <xsl:when test="$vEntry and not($vEntry/@display)"/>
      <xsl:otherwise/>
    </xsl:choose>
  </xsl:template>
  <!-- coding without a display: the verified display from the table -->
  <xsl:template match="fhir:coding[fhir:system][fhir:code][not(fhir:display)][e137:is-validated-system(string(fhir:system/@value))]" mode="ecr137-post" priority="1">
    <xsl:variable name="vEntry" select="if ($vDisplayDoc) then key('kDisplay', concat(fhir:system/@value, '|', fhir:code/@value), $vDisplayDoc)[1] else ()"/>
    <xsl:copy>
      <xsl:apply-templates select="@* | fhir:id | fhir:extension | fhir:system | fhir:version | fhir:code" mode="ecr137-post"/>
      <xsl:if test="$vEntry/@display"><display value="{$vEntry/@display}"/></xsl:if>
      <xsl:apply-templates select="fhir:userSelected" mode="ecr137-post"/>
    </xsl:copy>
  </xsl:template>
  <!-- CodeableConcept with no text keeps the first unverified source display as text -->
  <xsl:template match="fhir:*[fhir:coding][not(fhir:text)][fhir:coding[e137:is-validated-system(string(fhir:system/@value))][fhir:display]]" mode="ecr137-post" priority="-0.1">
    <xsl:variable name="vUnverified" select="fhir:coding[e137:is-validated-system(string(fhir:system/@value))][fhir:display][not($vDisplayDoc and key('kDisplay', concat(fhir:system/@value, '|', fhir:code/@value), $vDisplayDoc)/@display = fhir:display/@value)]"/>
    <xsl:copy>
      <xsl:apply-templates select="@* | node()" mode="ecr137-post"/>
      <xsl:if test="$vUnverified"><text value="{$vUnverified[1]/fhir:display/@value}"/></xsl:if>
    </xsl:copy>
  </xsl:template>
  <!-- ===== Terminology and structure rules from the terminology-enabled corpus run ===== -->

  <!-- coding.version copied from CDA codeSystemVersion is not a FHIR code system version (RxNorm '05062024'); keep only SNOMED CT edition URIs -->
  <xsl:template match="fhir:coding/fhir:version[not(starts-with(@value, 'http://snomed.info/sct/'))]" mode="ecr137-post"/>

  <!-- OIDs of HL7 terminology code systems that upstream leaves as urn:oid -->
  <xsl:variable name="vOidUri" as="map(xs:string, xs:string)" select="map{
      'urn:oid:2.16.840.1.113883.12.292' : 'http://hl7.org/fhir/sid/cvx' }"/>
  <xsl:template match="fhir:coding/fhir:system/@value[map:contains($vOidUri, string(.))]" mode="ecr137-post" priority="1" xmlns:map="http://www.w3.org/2005/xpath-functions/map">
    <xsl:attribute name="value" select="$vOidUri(string(.))"/>
  </xsl:template>

  <!-- Route abbreviations sent under the FDA route (NCI Thesaurus) system map to their NCIt concept codes -->
  <xsl:variable name="vNcitRoute" as="map(xs:string, xs:string)" select="map{
      'IM':'C28161', 'IV':'C38276', 'PO':'C38288', 'SC':'C38299', 'SQ':'C38299', 'ID':'C38238',
      'IN':'C38284', 'NAS':'C38284', 'TOP':'C38304', 'INH':'C38216', 'SL':'C38300', 'PR':'C38295', 'TD':'C38305' }"/>
  <xsl:template match="fhir:coding[fhir:system/@value = 'http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl'][map:contains($vNcitRoute, upper-case(string(fhir:code/@value)))]/fhir:code" mode="ecr137-post" xmlns:map="http://www.w3.org/2005/xpath-functions/map">
    <code value="{$vNcitRoute(upper-case(string(@value)))}"/>
  </xsl:template>

  <!-- Vital signs organizer: SNOMED 46680005 (inactive) becomes the FHIR vital signs panel code LOINC 85353-1 -->
  <xsl:template match="fhir:Observation/fhir:code[fhir:coding[fhir:system/@value = 'http://snomed.info/sct'][fhir:code/@value = '46680005']]" mode="ecr137-post" priority="1">
    <code>
      <coding>
        <system value="http://loinc.org"/>
        <code value="85353-1"/>
        <display value="Vital signs, weight, height, head circumference, oxygen saturation and BMI panel"/>
      </coding>
      <text value="Vital signs"/>
    </code>
  </xsl:template>

  <!-- Location reference carrying only data-absent-reason gets a display -->
  <xsl:template match="fhir:Encounter/fhir:location/fhir:location[not(fhir:reference) and not(fhir:identifier) and not(fhir:display)]" mode="ecr137-post" priority="1">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()" mode="ecr137-post"/>
      <display value="Unknown"/>
    </xsl:copy>
  </xsl:template>


  <!-- DocumentReference upstream adds for the source CDA document: referenced only by Composition.relatesTo (transforms)
       targetIdentifier, which keeps that identifier; the entry itself is unreachable from the Composition -->
  <xsl:template match="fhir:Bundle/fhir:entry[fhir:resource/fhir:DocumentReference[fhir:masterIdentifier/fhir:value/@value = //fhir:Composition/fhir:relatesTo[fhir:code/@value = 'transforms']/fhir:targetIdentifier/fhir:value/@value]]" mode="ecr137-post" priority="1"/>
  <xsl:template match="fhir:Provenance/fhir:entity[fhir:what/fhir:reference/@value = /fhir:Bundle/fhir:entry[fhir:resource/fhir:DocumentReference[fhir:masterIdentifier/fhir:value/@value = //fhir:Composition/fhir:relatesTo[fhir:code/@value = 'transforms']/fhir:targetIdentifier/fhir:value/@value]]/fhir:fullUrl/@value]" mode="ecr137-post" priority="1"/>
  <!-- Encounter.type repeating Encounter.class (ActCode AMB, IMP, EMER): class carries it -->
  <xsl:template match="fhir:Encounter/fhir:type[fhir:coding/fhir:system/@value = 'http://terminology.hl7.org/CodeSystem/v3-ActCode'][fhir:coding/fhir:code/@value = ../fhir:class/fhir:code/@value][count(fhir:coding) = 1][count(../fhir:type) gt 1]" mode="ecr137-post" priority="1"/>
  <!-- Primitive values never start or end with whitespace -->
  <xsl:template match="fhir:*/@value[matches(., '^\s|\s$')]" mode="ecr137-post" priority="-0.5">
    <xsl:attribute name="value" select="replace(., '^\s+|\s+$', '')"/>
  </xsl:template>
  <!-- us-core-race / us-core-ethnicity: a code outside the OMB categories belongs in 'detailed' -->
  <xsl:template match="fhir:extension[@url = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race']/fhir:extension[@url = 'ombCategory'][not(fhir:valueCoding/fhir:code/@value = ('1002-5', '2028-9', '2054-5', '2076-8', '2106-3', 'UNK', 'ASKU'))]/@url
                     | fhir:extension[@url = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity']/fhir:extension[@url = 'ombCategory'][not(fhir:valueCoding/fhir:code/@value = ('2135-2', '2186-5', 'UNK', 'ASKU'))]/@url" mode="ecr137-post" priority="1">
    <xsl:attribute name="url">detailed</xsl:attribute>
  </xsl:template>

  <!-- Coding without a code carries nothing; a CodeableConcept left with no coded value and no text goes with it -->
  <xsl:template match="fhir:coding[not(fhir:code/@value[normalize-space()])][not(.//fhir:extension)]" mode="ecr137-post" priority="1"/>
  <xsl:template match="fhir:*[fhir:coding][not(fhir:coding[fhir:code/@value[normalize-space()] or .//fhir:extension])][not(fhir:text/@value[normalize-space()])][not(fhir:extension)]" mode="ecr137-post" priority="0.9"/>

  <!-- eicr-procedure requires performed[x]: a procedure with no time in the source is unknown -->
  <xsl:template match="fhir:Procedure[fhir:meta/fhir:profile/@value = 'http://hl7.org/fhir/us/ecr/StructureDefinition/eicr-procedure'][not(fhir:*[starts-with(local-name(), 'performed')][.//@value[normalize-space()] or .//fhir:extension])]" mode="ecr137-post" priority="1">
    <xsl:variable name="vBefore" select="fhir:id | fhir:meta | fhir:implicitRules | fhir:language | fhir:text | fhir:contained | fhir:extension | fhir:modifierExtension | fhir:identifier | fhir:instantiatesCanonical | fhir:instantiatesUri | fhir:basedOn | fhir:partOf | fhir:status | fhir:statusReason | fhir:category | fhir:code | fhir:subject | fhir:encounter"/>
    <xsl:copy>
      <xsl:apply-templates select="@* | $vBefore" mode="ecr137-post"/>
      <performedDateTime><extension url="http://hl7.org/fhir/StructureDefinition/data-absent-reason"><valueCode value="unknown"/></extension></performedDateTime>
      <xsl:apply-templates select="* except ($vBefore | fhir:*[starts-with(local-name(), 'performed')])" mode="ecr137-post"/>
    </xsl:copy>
  </xsl:template>
  <!-- Lab orders (ServiceRequest) that no resource references join the Results section entries -->
  <xsl:template match="fhir:Composition/fhir:section[fhir:code/fhir:coding/fhir:code/@value = '30954-2'][1]" mode="ecr137-performer">
    <xsl:variable name="vRefs" select="//fhir:reference/@value"/>
    <xsl:copy>
      <xsl:apply-templates select="@* | node()" mode="ecr137-performer"/>
      <xsl:for-each select="/fhir:Bundle/fhir:entry[fhir:resource/fhir:ServiceRequest][not(fhir:fullUrl/@value = $vRefs)]">
        <entry><reference value="{fhir:fullUrl/@value}"/></entry>
      </xsl:for-each>
    </xsl:copy>
  </xsl:template>
  <!-- Lab Observations that carry no information (data-absent code, no value, no members with information), as when the
       form has no lab results: dropped together with every reference to them -->
  <xsl:function name="e137:no-info-obs" as="xs:string*">
    <xsl:param name="pBundle" as="element()"/>
    <xsl:param name="pKnown" as="xs:string*"/>
    <xsl:variable name="vNew" select="$pBundle/fhir:entry[fhir:resource/fhir:Observation[fhir:category/fhir:coding/fhir:code/@value = 'laboratory']
        [not(fhir:code/fhir:coding/fhir:code/@value[normalize-space()])]
        [not(fhir:*[starts-with(local-name(), 'value')][.//@value[normalize-space()]][not(fhir:extension/@url = 'http://hl7.org/fhir/StructureDefinition/data-absent-reason')])]
        [every $m in fhir:hasMember/fhir:reference/@value satisfies $m = $pKnown]]/fhir:fullUrl/@value[not(. = $pKnown)]"/>
    <xsl:sequence select="if (empty($vNew)) then $pKnown else e137:no-info-obs($pBundle, ($pKnown, $vNew))"/>
  </xsl:function>
  <xsl:template match="fhir:Bundle" mode="ecr137-performer" priority="2">
    <xsl:variable name="vDrop" select="e137:no-info-obs(., ())"/>
    <xsl:choose>
      <xsl:when test="exists($vDrop)">
        <xsl:variable name="vPruned">
          <xsl:copy>
            <xsl:copy-of select="@*"/>
            <xsl:for-each select="node()">
              <xsl:choose>
                <xsl:when test="self::fhir:entry[fhir:fullUrl/@value = $vDrop]"/>
                <xsl:otherwise><xsl:apply-templates select="." mode="e137-drop-refs"><xsl:with-param name="pDrop" select="$vDrop" tunnel="yes"/></xsl:apply-templates></xsl:otherwise>
              </xsl:choose>
            </xsl:for-each>
          </xsl:copy>
        </xsl:variable>
        <xsl:apply-templates select="$vPruned/fhir:Bundle" mode="ecr137-performer"/>
      </xsl:when>
      <xsl:otherwise><xsl:next-match/></xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <xsl:mode name="e137-drop-refs" on-no-match="shallow-copy"/>
  <xsl:template match="fhir:*[fhir:reference/@value]" mode="e137-drop-refs">
    <xsl:param name="pDrop" tunnel="yes"/>
    <xsl:if test="not(fhir:reference/@value = $pDrop)"><xsl:next-match/></xsl:if>
  </xsl:template>
</xsl:stylesheet>
