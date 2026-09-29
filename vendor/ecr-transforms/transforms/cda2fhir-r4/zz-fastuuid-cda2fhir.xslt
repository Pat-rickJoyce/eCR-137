<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:uuid="http://www.uuid.org" xmlns:f="urn:local" xmlns:xs="http://www.w3.org/2001/XMLSchema" version="3.0" exclude-result-prefixes="uuid xs f">
  <xsl:import href="NativeUUIDGen-cda2fhir.xslt"/>
  <xsl:param name="pSeed" select="string(current-dateTime())"/>
  <xsl:function name="f:hex8" as="xs:string">
    <xsl:param name="n" as="xs:double"/>
    <xsl:variable name="i" select="xs:integer(floor($n * 4294967296))"/>
    <xsl:sequence select="string-join(for $k in reverse(0 to 7) return substring('0123456789abcdef', 1 + ($i idiv xs:integer(math:pow(16,$k))) mod 16, 1), '')" xmlns:math="http://www.w3.org/2005/xpath-functions/math"/>
  </xsl:function>
  <xsl:function name="uuid:get-uuid" as="xs:string*">
    <xsl:param name="node"/>
    <xsl:variable name="r1" select="random-number-generator(concat($pSeed, generate-id($node)))"/>
    <xsl:variable name="r2" select="$r1?next()"/><xsl:variable name="r3" select="$r2?next()"/><xsl:variable name="r4" select="$r3?next()"/>
    <xsl:variable name="h" select="concat(f:hex8($r1?number), f:hex8($r2?number), f:hex8($r3?number), f:hex8($r4?number))"/>
    <xsl:sequence select="concat(substring($h,1,8),'-',substring($h,9,4),'-4',substring($h,14,3),'-a',substring($h,18,3),'-',substring($h,21,12))"/>
  </xsl:function>
</xsl:stylesheet>
