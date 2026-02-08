interface SepaDebit {
  id: string;
  memberId: string;
  memberName: string;
  iban: string | null;
  amount: number;
  selected: boolean;
  status?: string;
}

interface SepaConfig {
  creditorName: string;
  creditorIBAN: string;
  creditorId: string;
  creditorBIC?: string;
}

export class SepaDirectDebitGenerator {
  private config: SepaConfig;

  constructor(config: SepaConfig) {
    this.config = config;
  }

  generateXML(debits: SepaDebit[], executionDate: Date): string {
    const selectedDebits = debits.filter(d => d.selected && d.iban);

    if (selectedDebits.length === 0) {
      throw new Error("No valid debits selected for SEPA export");
    }

    const totalAmount = selectedDebits.reduce((sum, debit) => sum + debit.amount, 0);
    const paymentId = this.generatePaymentId();
    const messageId = this.generateMessageId();

    const xml = this.createXMLStructure({
      messageId,
      creationDate: new Date(),
      numberOfTransactions: selectedDebits.length,
      totalAmount,
      executionDate,
      paymentId,
      debits: selectedDebits,
    });

    return xml;
  }

  private createXMLStructure(data: {
    messageId: string;
    creationDate: Date;
    numberOfTransactions: number;
    totalAmount: number;
    executionDate: Date;
    paymentId: string;
    debits: SepaDebit[];
  }): string {
    const {
      messageId,
      creationDate,
      numberOfTransactions,
      totalAmount,
      executionDate,
      paymentId,
      debits,
    } = data;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${messageId}</MsgId>
      <CreDtTm>${this.formatDateTime(creationDate)}</CreDtTm>
      <NbOfTxs>${numberOfTransactions}</NbOfTxs>
      <CtrlSum>${this.formatAmount(totalAmount)}</CtrlSum>
      <InitgPty>
        <Nm>${this.escapeXml(this.config.creditorName)}</Nm>
        <Id>
          <OrgId>
            <Othr>
              <Id>${this.config.creditorId}</Id>
              <SchmeNm>
                <Cd>CUST</Cd>
              </SchmeNm>
            </Othr>
          </OrgId>
        </Id>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${paymentId}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${numberOfTransactions}</NbOfTxs>
      <CtrlSum>${this.formatAmount(totalAmount)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Cd>CORE</Cd>
        </LclInstrm>
        <SeqTp>
          <Cd>RCUR</Cd>
        </SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${this.formatDate(executionDate)}</ReqdColltnDt>
      <Cdtr>
        <Nm>${this.escapeXml(this.config.creditorName)}</Nm>
        <PstlAdr>
          <Ctry>ES</Ctry>
          <AdrLine>${this.escapeXml(this.config.creditorName)}</AdrLine>
        </PstlAdr>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>${this.config.creditorIBAN}</IBAN>
        </Id>
        <Ccy>EUR</Ccy>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>
          ${this.config.creditorBIC ? `<BIC>${this.config.creditorBIC}</BIC>` : ""}
        </FinInstnId>
      </CdtrAgt>
      <ChrgBr>SHAR</ChrgBr>
      ${debits.map(debit => this.createDirectDebitTransaction(debit)).join("\n      ")}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  }

  private createDirectDebitTransaction(debit: SepaDebit): string {
    const endToEndId = this.generateEndToEndId(debit);
    const mandateId = this.generateMandateId(debit);

    return `
<DrctDbtTxInf>
  <PmtId>
    <EndToEndId>${endToEndId}</EndToEndId>
  </PmtId>
  <InstdAmt Ccy="EUR">${this.formatAmount(debit.amount)}</InstdAmt>
  <DrctDbtTx>
    <MndtRltdInf>
      <MndtId>${mandateId}</MndtId>
      <DtOfSgntr>${this.formatDate(new Date("2023-01-01"))}</DtOfSgntr>
      <AmdmntInd>false</AmdmntInd>
    </MndtRltdInf>
  </DrctDbtTx>
  <DbtrAgt>
    <FinInstnId>
      <BIC>${this.extractBICFromIBAN(debit.iban!)}</BIC>
    </FinInstnId>
  </DbtrAgt>
  <Dbtr>
    <Nm>${this.escapeXml(debit.memberName)}</Nm>
    <PstlAdr>
      <Ctry>ES</Ctry>
      <AdrLine>${this.escapeXml(debit.memberName)}</AdrLine>
    </PstlAdr>
  </Dbtr>
  <DbtrAcct>
    <Id>
      <IBAN>${debit.iban}</IBAN>
    </Id>
    <Ccy>EUR</Ccy>
  </DbtrAcct>
  <RmtInf>
    <Ustrd>${this.escapeXml(`SEPA cobro ${debit.memberName} - ${this.formatDate(new Date())}`)}</Ustrd>
  </RmtInf>
</DrctDbtTxInf>`;
  }

  private formatDateTime(date: Date): string {
    return date.toISOString().replace("Z", "");
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  private formatAmount(amount: number): string {
    return amount.toFixed(2);
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private generateMessageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `MSG-${timestamp}-${random}`;
  }

  private generatePaymentId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `PMT-${timestamp}-${random}`;
  }

  private generateEndToEndId(debit: SepaDebit): string {
    return `E2E-${debit.id}-${Date.now()}`;
  }

  private generateMandateId(debit: SepaDebit): string {
    return `MANDATE-${debit.memberId}`;
  }

  private extractBICFromIBAN(iban: string): string {
    // This is a simplified BIC extraction
    // In a real implementation, you would use a BIC lookup service or bank code mapping
    const spanishBanks: { [key: string]: string } = {
      "2100": "BSCHESMM",
      "0049": "BSCHESMM",
      "0182": "BBVAESMM",
      "0075": "POPUESMM",
      "0081": "SABDESMM",
      "0061": "BKEAESMM",
      "0128": "BANKESMM",
      "0169": "OPENESMM",
      "0239": "CAIXESBB",
      "1490": "CAIXESBB",
      "2038": "CAIXESBB",
      "2105": "CAIXESBB",
      "2052": "CAIXESBB",
      "0030": "CAIXESBB",
      "0065": "CAIXESBB",
    };

    // Extract bank code from Spanish IBAN (positions 5-9)
    if (iban && iban.startsWith("ES") && iban.length >= 10) {
      const bankCode = iban.substring(4, 8);
      return spanishBanks[bankCode] || "BANKESMM"; // Default to generic bank BIC
    }

    return "BANKESMM"; // Default BIC for non-Spanish IBANs or invalid format
  }

  downloadXML(xml: string, filename?: string): void {
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename || `sepa-direct-debit-${new Date().toISOString().split("T")[0]}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Default configuration for Gure Txokoa
export const defaultSepaConfig: SepaConfig = {
  creditorName: "Gure Txokoa",
  creditorIBAN: "ES45000B12345678", // This should be replaced with actual IBAN
  creditorId: "ES45000B12345678",
  creditorBIC: "BANKESMM",
};
