# HowLongToBeat Collector

Collect games from your (or any public) HLTB profile.

## Preface
The current version only supports AWS lambda.
Since lambda is a bit wonky with puppeteer / chromium, the versioning has been locked in the layers. Update these versions at your own risk!

## Setup
1. Change the `hltbLink` in `template.yaml` to whatever profile you want to collect.
2. Manually create your own infrastructure stack, make sure the table is called `hltb-games`.
2. Deploy this stack with SAM.