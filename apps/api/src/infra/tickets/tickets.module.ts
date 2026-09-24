import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { OneTimeTicketService } from "./one-time-ticket.service";

@Global()
@Module({
  // Solo para firmar y verificar pases; el secreto va en cada llamada.
  imports: [JwtModule.register({})],
  providers: [OneTimeTicketService],
  exports: [OneTimeTicketService],
})
export class TicketsModule {}
