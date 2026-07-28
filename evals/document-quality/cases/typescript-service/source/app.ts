export interface RequestBody { value: string }
export const API_URL = process.env.API_URL;
export const status = "ready";
export function main() { writeFileSync("out.json", "{}"); }
app.post("/users", main);
