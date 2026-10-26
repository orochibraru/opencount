# Receipt reading

Receipt reading turns a photo or a PDF of a receipt into a prefilled expense:
amount, date and merchant. It is off by default, optional, and entirely local.
What members see is on [Scanning receipts](receipts).

## Local by design

The receipt is read on your server by
[Tesseract](https://tesseract-ocr.github.io/), an open-source OCR engine, then
parsed into a total, a date, a merchant and line items. The file lives in memory
for the length of the request and is never written to disk or the database; only
the reading goes back to the browser. Nothing is sent to any outside service.

Reading happens while the person waits, with a two-minute limit per file. Files
are capped at 10 MB, in JPEG, PNG, WebP or PDF.

## Turning it on

**Admin, Receipts** shows what this server has:

- whether Tesseract is installed, and which language packs it has;
- whether PDFs can be read, which needs Poppler's `pdftotext` and `pdftoppm`
  next to Tesseract. The Docker image ships both.

Pick the languages your receipts are printed in and save. Reading in several
languages at once works, but each extra one makes it a little slower and can
make it a little less accurate, so pick only what you need.

**Try a receipt** reads a file right there and shows everything: merchant, date,
total, the line items it found and the raw text Tesseract recognized. Use it to
check the languages before members rely on them.

**Turn off receipt reading** removes the **Scan a receipt** button from the
expense sheet.

## Languages

The published image ships English, French, German, Spanish and Italian
(`eng fra deu spa ita`). To ship others, build the image with the
`OCR_LANGUAGES` build argument, listing Alpine `tesseract-ocr-data-*` package
suffixes:

```bash
docker buildx build --build-arg OCR_LANGUAGES="eng fra nld por" \
  -t opencount:latest .
```

Outside Docker, install Tesseract and its language data yourself
(`apt install tesseract-ocr` or `brew install tesseract tesseract-lang`), and
Poppler for PDFs (`apt install poppler-utils` or `brew install poppler`).

## PDFs

A PDF is read from its first page. When the page carries text, like a receipt
emailed by a shop, that text is used directly. When it doesn't, like a scan, the
page is rendered at 300 dpi, at most 2500 px, and read by Tesseract. Scans run
one at a time. Both go through pipes; nothing touches the disk.

## How the parsing works

- **Total**: the largest amount on a line that says total in one of the
  languages it knows (_total_, _montant_, _summe_, _betrag_, _importe_, _à
  payer_, _amount due_ and more), skipping subtotals. With no such line, the
  largest amount on the receipt.
- **Line items**: lines with words and an amount, minus tax, change, tips and
  card lines; at most 50.
- **Date**: ISO dates first, then day-first local dates.
- **Merchant**: the first line with at least three letters and no amount.
- **Currency**: from a symbol or code like `€`, `£`, `CHF` or `zł`. It formats
  the total in the admin test but is not applied to an expense, whose currency
  is the group's.
