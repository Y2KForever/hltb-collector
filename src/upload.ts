import { exec } from 'child_process';
const childProcess = exec('./scripts/upload_to_dynamodb.bat', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log(stdout);
});
childProcess.on('exit', (code) => {
  console.log(`Batch script exited with code ${code}`);
});
