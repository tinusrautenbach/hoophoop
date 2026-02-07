export type ParsedPlayer = {
    name: string;
    number: string;
};

export function parsePlayerList(input: string): ParsedPlayer[] {
    // Normalize newlines and split by newline or comma
    const lines = input.split(/[\n,]+/).map(line => line.trim()).filter(Boolean);

    return lines.map(line => {
        // Attempt to match "23 Name" or "Name 23"
        // Regex: First capture groups digits, rest is name. Or vice versa.
        const matchNumberFirst = line.match(/^(\d+)\s+(.+)$/);
        const matchNumberLast = line.match(/^(.+)\s+(\d+)$/);

        if (matchNumberFirst) {
            return { number: matchNumberFirst[1], name: matchNumberFirst[2].trim() };
        }
        if (matchNumberLast) {
            return { name: matchNumberLast[1].trim(), number: matchNumberLast[2] };
        }

        // Fallback: Check if just a number or just a name? 
        // For now simple return entire string as name, empty number
        return { name: line, number: "" };
    });
}
