import fs from 'fs';
import path from 'path';

export default class MarkdownReporter {
  onTestRunEnd(files, errors, reason) {
    console.log('[MarkdownReporter] onTestRunEnd called with', files?.length, 'files');
    
    const testsDir = path.resolve(process.cwd(), 'tests');
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }

    const totalFiles = files.length;
    
    // Handle new Vitest 4 structure - files are TestModule objects with children (TestCollection)
    // Use allTests() to get all tests recursively, not just top-level
    const allTests = files.flatMap(f => [...(f.children?.allTests() || [])]);
    const totalTests = allTests.length;
    
    const failedTests = allTests.filter(t => t.result?.().state === 'failed').length;
    const passedTests = totalTests - failedTests;
    
    // Check for files that failed at module level (import errors, etc.)
    const failedFiles = files.filter(f => {
      // Check if module itself failed
      if (f.state?.() === 'failed') return true;
      // Check if it has any failed tests
      const tests = [...(f.children?.allTests() || [])];
      return tests.some(t => t.result?.().state === 'failed');
    }).length;
    const passedFiles = totalFiles - failedFiles;

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

    files.sort((a, b) => (a.moduleId || '').localeCompare(b.moduleId || '')).forEach(file => {
      const fileName = path.relative(process.cwd(), file.moduleId || 'unknown');
      const fileTasks = [...(file.children?.allTests() || [])];
      const fTotal = fileTasks.length;
      const fFailed = fileTasks.filter(t => t.result?.().state === 'failed').length;
      const fPassed = fTotal - fFailed;
      const hasModuleError = file.state?.() === 'fail';
      const status = (fFailed > 0 || hasModuleError) ? '❌' : '✅';
      suiteContent += `| ${fileName} | ${status} | ${fPassed} | ${fFailed} | ${fTotal} |\n`;
    });

    fs.writeFileSync(suiteResultsPath, suiteContent);
    console.log('[MarkdownReporter] Written TEST_SUITE_RESULTS.md');

    // Update TEST_REPORT.md with failures
    const reportPath = path.join(testsDir, 'TEST_REPORT.md');
    let reportContent = `# Detailed Test Report\n\n`;
    reportContent += `**Date**: ${timestamp}\n\n`;
    
    if (failedTests > 0 || failedFiles > 0) {
      reportContent += `## ❌ Failures\n\n`;
      
      // Report module-level failures first
      files.forEach(file => {
        if (file.state?.() === 'fail') {
          reportContent += `### ${path.relative(process.cwd(), file.moduleId || 'unknown')}\n`;
          reportContent += `- **Module failed to load**\n`;
          if (file.errors?.length > 0) {
            file.errors.forEach(err => {
              const cleanMsg = (err.message || 'Unknown error').replace(/\n/g, '\n  ');
              reportContent += `  \`\`\`\n  ${cleanMsg}\n  \`\`\`\n`;
            });
          }
          reportContent += `\n`;
        }
      });
      
      // Report test-level failures
      files.forEach(file => {
        const fileTasks = [...(file.children?.allTests() || [])];
        const failures = fileTasks.filter(t => t.result?.().state === 'failed');
        if (failures.length > 0) {
          reportContent += `### ${path.relative(process.cwd(), file.moduleId || 'unknown')}\n`;
          failures.forEach(t => {
            reportContent += `- **${t.name}**\n`;
            const result = t.result?.();
            if (result?.errors) {
              result.errors.forEach(err => {
                const cleanMsg = (err.message || 'No error message').replace(/\n/g, '\n  ');
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
    console.log('[MarkdownReporter] Written TEST_REPORT.md');
  }
}
