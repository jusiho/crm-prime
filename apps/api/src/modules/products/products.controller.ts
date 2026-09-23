import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  createProductSchema,
  importProductsSchema,
  updateProductSchema,
  type CreateProductInput,
  type ImportProductsInput,
  type ImportProductsResult,
  type ProductDto,
  type UpdateProductInput,
} from "@crm/shared";
import type { Prisma } from "@prisma/client";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../infra/prisma/prisma.service";
<<<<<<< HEAD
import { TenantService } from "../../infra/tenant/tenant.service";
=======
import { i18n } from "../../i18n/i18n";
>>>>>>> 2da1df078dfaeb0e81b9d1a84182da2d2c7e8417

@Controller("products")
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  @Get()
  async list(@Query("search") search?: string): Promise<ProductDto[]> {
    const rows = await this.prisma.product.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((p) => this.toDto(p));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createProductSchema)) body: CreateProductInput,
  ): Promise<ProductDto> {
    // El SKU es único en la BD: sin esta comprobación, un duplicado sale
    // como un 500 opaco en vez de decirle al usuario qué corregir.
    await this.assertSkuFree(body.sku, null);
    const p = await this.prisma.product.create({
      data: {
        orgId: this.tenant.orgId(),
        name: body.name,
        sku: body.sku,
        description: body.description,
        price: body.price,
        currency: body.currency,
        imageUrl: body.imageUrl,
        isActive: body.isActive,
      },
    });
    return this.toDto(p);
  }

  /**
   * Importación masiva desde CSV. El archivo se lee en el navegador (misma
   * librería que aquí), así que llegan filas ya normalizadas. Una fila con
   * problemas no aborta el resto: se reporta y se sigue.
   */
  @Post("import")
  async import(
    @Body(new ZodValidationPipe(importProductsSchema))
    body: ImportProductsInput,
  ): Promise<ImportProductsResult> {
    const result: ImportProductsResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };
    // Un mismo SKU repetido dentro del archivo: se queda el primero.
    const seenSkus = new Set<string>();

    for (const [index, row] of body.rows.entries()) {
      // Fila 1 = cabecera, así que la primera de datos es la 2 para el usuario.
      const rowNumber = index + 2;
      try {
        if (row.sku && seenSkus.has(row.sku)) {
          result.skipped++;
          result.errors.push({
            row: rowNumber,
            message: `El SKU "${row.sku}" está repetido en el archivo`,
          });
          continue;
        }
        if (row.sku) seenSkus.add(row.sku);

        const existing = row.sku
          ? await this.prisma.product.findUnique({ where: { sku: row.sku } })
          : null;

        if (existing && !body.updateExisting) {
          result.skipped++;
          continue;
        }

        const data = {
          name: row.name,
          sku: row.sku,
          description: row.description,
          price: row.price,
          currency: row.currency,
          imageUrl: row.imageUrl,
          isActive: row.isActive,
        };

        if (existing) {
          await this.prisma.product.update({ where: { id: existing.id }, data });
          result.updated++;
        } else {
          await this.prisma.product.create({ data });
          result.created++;
        }
      } catch (e) {
        result.skipped++;
        result.errors.push({
          row: rowNumber,
          message: (e as Error).message.slice(0, 200),
        });
      }
    }

    return result;
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProductInput,
  ): Promise<ProductDto> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Producto no encontrado");
    if (body.sku !== undefined) await this.assertSkuFree(body.sku, id);
    const p = await this.prisma.product.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.sku !== undefined ? { sku: body.sku } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.price !== undefined ? { price: body.price } : {}),
        ...(body.currency !== undefined ? { currency: body.currency } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });
    return this.toDto(p);
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Producto no encontrado");
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }

  // Varios productos pueden quedarse sin SKU (null), pero un SKU con valor
  // no puede repetirse. `ignoreId` permite que un producto conserve el suyo.
  private async assertSkuFree(
    sku: string | null | undefined,
    ignoreId: string | null,
  ): Promise<void> {
    if (!sku) return;
    const dup = await this.prisma.product.findFirst({ where: { sku } });
    if (dup && dup.id !== ignoreId) {
      throw new ConflictException(i18n("product.skuTaken", { sku }));
    }
  }

  private toDto(p: {
    id: string;
    name: string;
    sku: string | null;
    description: string | null;
    price: Prisma.Decimal;
    currency: string;
    imageUrl: string | null;
    isActive: boolean;
    createdAt: Date;
  }): ProductDto {
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      description: p.description,
      price: Number(p.price),
      currency: p.currency,
      imageUrl: p.imageUrl,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
