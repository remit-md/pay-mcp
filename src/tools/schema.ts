/**
 * Convert a Zod schema to a JSON Schema suitable for MCP tool inputSchema.
 *
 * Uses zod-to-json-schema, strips $schema and additionalProperties.
 */

import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface ToolInputSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export function zodToMcpSchema(schema: z.ZodType): ToolInputSchema {
  const jsonSchema = zodToJsonSchema(schema, { $refStrategy: "none" }) as Record<string, unknown>;
  delete jsonSchema["$schema"];
  delete jsonSchema["additionalProperties"];
  return jsonSchema as ToolInputSchema;
}
