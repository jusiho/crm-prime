import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductFieldsController } from "./product-fields.controller";

@Module({
  controllers: [ProductsController, ProductFieldsController],
})
export class ProductsModule {}
