# Teach Game Kahoot Import Research

## Permitted Import Scope

The Teach game importer will accept a user-supplied `.xlsx` file in Kahoot’s published quiz spreadsheet template shape. Kahoot’s current creator documentation describes this as an **import into Kahoot**, not a general export API; the official help article says the spreadsheet import supports **quiz questions only**. The Teach importer will therefore import the equivalent multiple-choice quiz slides and retain source-file validation feedback rather than attempting to scrape or access Kahoot accounts.

## Supported Fields

The documented spreadsheet format supports questions, at least two answers, correct-answer indexes, and time limits of 5, 10, 20, 30, 60, or 120 seconds. The Teach importer will map those fields into game slides, then allow educators to enrich the imported game with image, video URL, GIF, word-cloud, hotspot, and puzzle slides in the Teach editor.

## Boundaries

The importer does not access a Kahoot account, private Kahoot URLs, or unsupported export data. Users supply the spreadsheet they are authorised to import. Kahoot-specific media and non-quiz interactions are not assumed to be present in the spreadsheet and will not be fabricated during import.

## Sources

- https://support.kahoot.com/hc/en-us/articles/115002812547-How-to-import-questions-from-a-spreadsheet-to-your-kahoot
- https://kahoot.com/blog/2018/08/23/import-kahoot-from-spreadsheet/
