const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * @type {import('esbuild').BuildOptions}
 */
const baseConfig = {
    bundle: true,
    minify: production,
    sourcemap: !production,
    platform: "node",
    external: ["vscode"],
    format: "cjs",
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
};

async function main() {
    const ctx = await esbuild.context(baseConfig);
    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
