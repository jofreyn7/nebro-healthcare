export default [
  {
    files: ["script.js", "admin.js", "supabase-config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        fetch: "readonly",
        console: "readonly",
        supabase: "readonly",
        Chart: "readonly",
        jsPDF: "readonly",
        XLSX: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn",
      "no-console": "off"
    }
  }
];
