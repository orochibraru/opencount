# Scanning receipts

When an admin has turned receipt reading on, the expense sheet offers **Scan a
receipt** while you add an expense. Pick a photo or a PDF and OpenCount fills in
what it can read.

## What it fills in

- **Amount**: the total. It looks for a line saying _total_, _montant_, _summe_,
  _à payer_, _amount due_ and their cousins, and leaves out subtotals, tax,
  change and tips. With no such line, it takes the largest amount on the
  receipt.
- **Date**: the first date it finds, read day first (`01/02/2026` is 1 February)
  unless that can't be a date.
- **Merchant**: the first line with words and no amount, which on most receipts
  is the shop's name. It also becomes the description when that is still empty,
  and suggests a category like a picked merchant does.

The reading is a draft, not a verdict: check the amount before saving. A
crumpled, dark or skewed photo reads badly; a flat, sharp one in good light
reads well.

## What it accepts

JPEG, PNG, WebP or PDF, up to 10 MB. A PDF is read from its first page: its text
directly when it has some, like an emailed receipt, or as an image when it is a
scan.

## Privacy

The receipt never leaves your server and is never stored. It is read in memory
by Tesseract, an OCR engine installed on the server, while you wait; only the
reading comes back to the sheet, and the file is gone once the request ends. No
cloud service is involved.

Scanning is only offered when adding an expense, not when editing one. Admins
set it up in [Receipt reading](receipt-reading).
