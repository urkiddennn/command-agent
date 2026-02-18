const path = require('path');

function resolvePath(relativePath) {
    const root = "C:\\Users\\richa\\OneDrive\\Documents\\programming\\command";

    // Simulate the logic in ToolHandler.ts
    const absolutePath = path.isAbsolute(relativePath)
        ? relativePath
        : path.join(root, relativePath);

    return path.normalize(absolutePath);
}

// Test cases
const test1 = "html_landing_page/index.html";
const test2 = "@html_landing_page/index.html";

console.log(`Test 1 (Normal): ${resolvePath(test1)}`);
console.log(`Test 2 (With @): ${resolvePath(test2)}`);
