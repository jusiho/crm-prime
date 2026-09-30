import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ZodSchema, type ZodIssue } from "zod";
import { i18n, type I18nMessage } from "../../i18n/i18n";

/**
 * Valida y tipa el payload con un esquema Zod compartido (packages/shared).
 * Uso: @Body(new ZodValidationPipe(loginSchema)) body: LoginInput
 *
 * Cada problema sale como "campo: explicación" en el idioma del cliente
 * (el filtro de excepciones traduce al responder), en vez del inglés
 * técnico de Zod ("String must contain at most 2000 character(s)").
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map(describeIssue));
    }
    return result.data;
  }
}

// Los mensajes por defecto de Zod, en inglés. Cualquier otro texto lo puso
// el esquema a propósito (p. ej. "Ponle un nombre") y se respeta.
const ZOD_DEFAULT = /^(String|Array|Number|Date|Set|BigInt|Value) must |^Required$|^Invalid |^Expected /;

function describeIssue(issue: ZodIssue): I18nMessage | string {
  const field = issue.path.join(".") || "body";
  if (!ZOD_DEFAULT.test(issue.message)) return `${field}: ${issue.message}`;

  switch (issue.code) {
    case "too_small": {
      const min = Number(issue.minimum);
      if (issue.type === "string") {
        return min <= 1 ? i18n("validation.required", { field }) : i18n("validation.minLength", { field, min });
      }
      if (issue.type === "array") return i18n("validation.minItems", { field, min });
      return i18n("validation.min", { field, min });
    }
    case "too_big": {
      const max = Number(issue.maximum);
      if (issue.type === "string") return i18n("validation.maxLength", { field, max });
      if (issue.type === "array") return i18n("validation.maxItems", { field, max });
      return i18n("validation.max", { field, max });
    }
    case "invalid_type":
      return issue.received === "undefined" || issue.received === "null"
        ? i18n("validation.required", { field })
        : i18n("validation.invalidType", { field, expected: issue.expected });
    case "invalid_enum_value":
      return i18n("validation.invalidOption", { field, options: issue.options.join(", ") });
    case "invalid_string":
      return i18n("validation.invalidFormat", {
        field,
        format: typeof issue.validation === "string" ? issue.validation : "text",
      });
    default:
      return i18n("validation.invalid", { field, reason: issue.message });
  }
}
