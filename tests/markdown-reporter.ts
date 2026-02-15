import fs from 'fs';
import path from 'path';

export default class MarkdownReporter {
  onFinished(files) {
    const testsDir = path.resolve(process.cwd(), 'tests');
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }

    const totalFiles = files.length;
    const failedFiles = files.filter(f => f.result?.state === 'fail').length;
    const passedFiles = totalFiles - failedFiles;

    const allTests = files.flatMap(f => f.tasks || []);
    const totalTests = allTests.length;
    const failedTests = allTests.filter(t => t.result?.state === 'fail').length;
    const passedTests = totalTests - failedTests;

    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    
    // Update TEST_SUITE_RESULTS.md
    const suiteResultsPath = path.join(testsDir, 'TEST_SUITE_RESULTS.md');
    let suiteContent = `# Test Suite Results\n\n`;
    suiteContent += `**Last Run**: ${timestamp}\n`;
    suiteContent += `**Overall Status**: ${failedTests > 0 ? '❌ FAILED' : '✅ PASSED'}\n\n`;
    suiteContent += `### Summary\n`;
    suiteContent += `- **Test Files**: ${totalFiles} (${passedFiles} passed, ${failedFiles} failed)\n`;
    suiteContent += `- **Total Tests**: ${totalTests} (${passedTests} passed, ${failedTests} failed)\n\n`;
    suiteContent += `### Detailed Results by File\n\n`;
    suiteContent += `| File | Status | Passed | Failed | Total |\n`;
    suiteContent += `| :--- | :--- | :--- | :--- | :--- |\n`;

    files.sort((a, b) => a.filepath.localeCompare(b.filepath)).forEach(file => {
      const fileName = path.relative(process.cwd(), file.filepath);
      const fileTasks = file.tasks || [];
      const fTotal = fileTasks.length;
      const fFailed = fileTasks.filter(t => t.result?.state === 'fail').length;
      const fPassed = fTotal - fFailed;
      const status = fFailed > 0 ? '❌' : '✅';
      suiteContent += `| ${fileName} | ${status} | ${fPassed} | ${fFailed} | ${fTotal} |\n`;
    });

    fs.writeFileSync(suiteResultsPath, suiteContent);

    // Update TEST_REPORT.md with failures
    const reportPath = path.join(testsDir, 'TEST_REPORT.md');
    let reportContent = `# Detailed Test Report\n\n`;
    reportContent += `**Date**: ${timestamp}\n\n`;
    
    if (failedTests > 0) {
      reportContent += `## ❌ Failures\n\n`;
      files.forEach(file => {
        const fileTasks = file.tasks || [];
        const failures = fileTasks.filter(t => t.result?.state === 'fail');
        if (failures.length > 0) {
          reportContent += `### ${path.relative(process.cwd(), file.filepath)}\n`;
          failures.forEach(t => {
            reportContent += `- **${t.name}**\n`;
            if (t.result?.errors) {
              t.result.errors.forEach(err => {
                const cleanMsg = err.message || 'No error message';
                reportContent += `  \`\`\`\n  ${cleanMsg}\n  \`\`\`\n`;
              });
            }
          });
          reportContent += `\n`;
        }
      });
    } else {
      reportContent += `## ✅ All tests passed!\n`;
    }

    fs.writeFileSync(reportPath, reportContent);
    
    // Log clearly to terminal
    console.log('\n--- Markdown Report Generated ---');
    console.log(`Updated: ${suiteResultsPath}`);
    console.log(`Updated: ${reportPath}`);
    console.log('--------------------------------\n');
  }
}
