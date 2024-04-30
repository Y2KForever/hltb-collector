@echo off
setlocal enabledelayedexpansion
chcp 65001

node -r dotenv/config %~dp0\.env-loader.ts

set tableName=%ddb_table%
set AWS_CLI_FILE_ENCODING=UTF-8
set jsonFolder=files

for %%f in ("%jsonFolder%\*.json") do (
    echo Processing %%f
    echo Starting AWS Upload >> log.txt
    aws dynamodb batch-write-item --request-items file://%%f --cli-binary-format raw-in-base64-out
)

echo Upload process complete!
echo Batch Script Finished >> log.txt
exit 0