# henko-contracts

Los contratos entre las piezas de Henko, en zod: qué se pide, qué se
responde y qué eventos salen. **Un paquete por módulo**, así cada servicio
depende sólo de los contratos que usa.

| Paquete                              | Qué define                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `@henko-software/contracts-identity` | API interna de `identity` (sesiones, usuarios, dispositivos), roles, errores y eventos |
| `@henko-software/contracts-bff`      | API pública de `henko-bff`, la que usa `henko-web`                                     |

## Reglas

- **El contrato se cambia acá primero**, y después los servicios.
- **Un cambio que rompe** (sacar un campo, cambiar un tipo) sube el mayor del
  paquete y convive con la versión anterior hasta que nadie la use.
- Los ids son UUIDv7, las fechas ISO en UTC, la plata en centavos.
- Los eventos se nombran `<módulo>.<entidad>.<hecho>.v<n>`.

## Publicar

Subir el `version` del paquete y llegar a `main`.
