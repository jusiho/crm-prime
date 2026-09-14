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
  updateProductSchema,
  type CreateProductInput,
  type ProductDto,
  type UpdateProductInput,
} from "@crm/shared";
import type { Prisma } from "@prisma/client";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Controller("products")
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}

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
    const dup = await this.prisma.product.findUnique({ where: { sku } });
    if (dup && dup.id !== ignoreId) {
      throw new ConflictException(`Ya existe un producto con el SKU "${sku}"`);
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
