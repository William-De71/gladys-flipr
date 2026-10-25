# Flipr

## Presentación

Esta integración trae a Gladys su analizador de piscina conectado **Flipr** y el **Flipr Hub**:

- un dispositivo por analizador: temperatura del agua, pH, cloro, redox (ORP), batería, y la valoración del pH y del cloro que da Flipr (demasiado bajo, algo bajo, ideal, algo alto, demasiado alto);
- un dispositivo por Hub: filtración encendida o apagada y modo de filtración (automático, manual, programación), ambos controlables desde Gladys;
- disparadores de escena (nueva medida, valoración del agua cambiada, sin medida desde hace 24 horas, filtración conmutada por el Hub) y acciones de escena (leer la última medida, cambiar el modo de filtración);
- un widget de panel «Agua de la piscina».

Flipr no tiene API local: el analizador envía sus medidas a la nube de Flipr aproximadamente una vez por hora, y la integración las lee allí con su cuenta Flipr (transporte en la nube). Su correo y su contraseña solo van a la nube de Flipr, como con la aplicación Flipr.

![Widget Agua de la piscina, una piscina equilibrada y una piscina cuyo pH ha subido (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-flipr/main/docs/assets/widgets.es.png)

## Requisitos

- Gladys Assistant 5.3.0 o posterior.
- Un analizador Flipr (Start, AnalysR…) que ya funcione en la aplicación móvil Flipr, y opcionalmente un Flipr Hub.
- El correo y la contraseña de su cuenta Flipr.

## Configuración

1. Integraciones → Flipr → Configuración.
2. Rellene los campos y guarde.

| Campo                      | Descripción                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Correo electrónico         | El correo de su cuenta Flipr.                                                                                        |
| Contraseña                 | Su contraseña, guardada como secreto y nunca vuelta a mostrar.                                                       |
| Intervalo de lectura (min) | De 5 a 60 minutos, 15 por defecto. El analizador mide aproximadamente una vez por hora: no hace falta ir más rápido. |
| Idioma de los textos       | Nombres de las funciones, valoraciones y resúmenes de las escenas. Automático: el idioma de su panel.                |

**Probar la conexión** inicia sesión en Flipr e indica cuántos analizadores y Hubs tiene la cuenta.

## Uso

### Dispositivos

Dispositivos → Flipr → **Descubrir**, y añada el analizador («Flipr AB256C») y el Hub («Flipr Hub CD256C»). Sus valores aparecen en la siguiente lectura.

| Dispositivo | Funciones                                                                              |
| ----------- | -------------------------------------------------------------------------------------- |
| Analizador  | Temperatura del agua, pH, cloro (mg/L), redox (mV), batería, estado del pH y del cloro |
| Flipr Hub   | Filtración (encendida/apagada), modo de filtración (automático, manual, programación)  |

Encender o apagar la filtración pone el Hub en modo manual, como hace la aplicación Flipr. Elija de nuevo «Automático» o «Programación» para devolver el control al Hub.

### Escenas

Disparadores:

- **Flipr: nueva medida**: cada nueva medida, con todos sus valores como variables.
- **Flipr: valoración del agua cambiada**: el pH o el cloro cambió de valoración. Filtre por el parámetro y la nueva valoración («Demasiado bajo» y «Demasiado alto» para una alerta).
- **Flipr: sin medida desde hace 24 horas**: pila agotada, modo invierno, red. Se dispara una vez.
- **Flipr Hub: filtración conmutada**: el Hub arrancó o paró la bomba por sí mismo (programación, modo automático, aplicación Flipr). No se dispara con los comandos enviados desde Gladys.

Acciones:

- **Flipr: leer la última medida**: temperatura, pH, cloro, redox, batería, valoraciones y una frase lista.
- **Flipr Hub: cambiar el modo de filtración**: automático, manual o programación.

Ejemplos:

- Cuando la valoración del agua pase a «Demasiado bajo» o «Demasiado alto» → enviar un mensaje con `{{triggerEvent.data.summary}}`.
- Cuando no haya medida desde hace 24 horas → recordarme revisar el Flipr.
- Cada tarde a las 20:00 → leer la última medida y enviar su resumen.

### Widget

Panel → Editar → añada **Agua de la piscina**. Elija el analizador, el Hub, el gráfico (temperatura, pH, cloro, redox o ninguno) y su periodo. El gráfico muestra el historial que guarda Gladys: aparece en cuanto se añade el dispositivo del analizador.

## Solución de problemas

- **«Flipr rechazó el correo o la contraseña»**: compruébelos en la aplicación Flipr y luego en la configuración.
- **Ningún dispositivo en Descubrir**: la cuenta no tiene analizador ni Hub, o Flipr aún no se ha leído: use «Probar la conexión».
- **«Aún sin medida»**: el Flipr está en modo invierno o sin calibrar; vuelve a medir una vez en el agua y calibrado en la aplicación Flipr.
- **Valores algo retrasados**: Flipr mide aproximadamente una vez por hora, y la integración lee la nube cada 15 minutos por defecto.
- **«La nube de Flipr no responde» o «Flipr limita las peticiones»**: la integración lo vuelve a intentar en la siguiente lectura. La empresa detrás de Flipr fue liquidada en 2025 y el servicio vuelve a funcionar desde 2026: si el problema persiste, compruebe que la aplicación Flipr sigue funcionando.
- **Registros**: añada la variable de entorno `DEBUG=gladys-integration-sdk` y abra una issue en [GitHub](https://github.com/William-De71/gladys-flipr/issues) con las versiones de Gladys y de la integración y los registros (la contraseña nunca aparece en ellos).

La API utilizada es la de la aplicación Flipr: Flipr no publica ninguna documentación oficial de ella, y puede cambiar sin previo aviso.
