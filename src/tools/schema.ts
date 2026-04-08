/**
 * Convert a Zod schema to a JSON Schema suitable for MCP tool inputSchema.
 *
 * Uses zod 4's built-in toJSONSchema, strips $schema and additionalProperties.
 */

import type { z } from "zod";
import { toJSONSchema } from "zod";

export interface ToolInputSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export function zodToMcpSchema(schema: z.ZodType): ToolInputSchema {
  const jsonSchema = toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema["$schema"];
  delete jsonSchema["additionalProperties"];
  return jsonSchema as ToolInputSchema;
}
