import { redirect } from "next/navigation";

/**
 * URL de "Instrucciones de eliminación de datos" para la app de Meta. Las
 * instrucciones viven en la política de privacidad; esto solo da una
 * dirección limpia que lleva a esa sección.
 */
export default function DataDeletionPage() {
  redirect("/privacy#eliminacion");
}
