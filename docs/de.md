# Flipr

## Überblick

Diese Integration bringt Ihren vernetzten Poolanalysator **Flipr** und den **Flipr Hub** in Gladys:

- ein Gerät pro Analysator: Wassertemperatur, pH-Wert, Chlor, Redox (ORP), Batterie sowie die Bewertung von pH und Chlor durch Flipr (zu niedrig, etwas niedrig, ideal, etwas hoch, zu hoch);
- ein Gerät pro Hub: Filterung ein/aus und Filtermodus (automatisch, manuell, Zeitplan), beides aus Gladys steuerbar;
- Szenenauslöser (neue Messung, Wasserbewertung geändert, seit 24 Stunden keine Messung, Filterung vom Hub umgeschaltet) und Szenenaktionen (letzte Messung lesen, Filtermodus ändern);
- ein Dashboard-Widget „Poolwasser“.

Flipr hat keine lokale API: Der Analysator sendet seine Messungen etwa einmal pro Stunde an die Flipr-Cloud, und die Integration liest sie dort mit Ihrem Flipr-Konto (Cloud-Transport). Ihre E-Mail und Ihr Passwort gehen nur an die Flipr-Cloud, wie mit der Flipr-App.

![Widget Poolwasser, ein ausgeglichener Pool und ein Pool mit gestiegenem pH-Wert (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-flipr/main/docs/assets/widgets.de.png)

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Ein Flipr-Analysator (Start, AnalysR…), der bereits in der Flipr-App funktioniert, und optional ein Flipr Hub.
- E-Mail und Passwort Ihres Flipr-Kontos.

## Konfiguration

1. Integrationen → Flipr → Konfiguration.
2. Füllen Sie die Felder aus und speichern Sie.

| Feld                 | Beschreibung                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| E-Mail               | Die E-Mail Ihres Flipr-Kontos.                                                                               |
| Passwort             | Das zugehörige Passwort, als Geheimnis gespeichert und nie wieder angezeigt.                                 |
| Leseintervall (Min.) | 5 bis 60 Minuten, standardmäßig 15. Der Analysator misst etwa einmal pro Stunde: Schneller lohnt sich nicht. |
| Sprache der Texte    | Namen der Funktionen, Bewertungen und Szenen-Zusammenfassungen. Automatisch: die Sprache Ihres Dashboards.   |

**Verbindung testen** meldet sich bei Flipr an und zeigt, wie viele Analysatoren und Hubs das Konto hat.

## Verwendung

### Geräte

Geräte → Flipr → **Entdecken**, dann den Analysator („Flipr AB256C“) und den Hub („Flipr Hub CD256C“) hinzufügen. Ihre Werte erscheinen beim nächsten Lesen.

| Gerät      | Funktionen                                                                           |
| ---------- | ------------------------------------------------------------------------------------ |
| Analysator | Wassertemperatur, pH-Wert, Chlor (mg/L), Redox (mV), Batterie, pH- und Chlor-Zustand |
| Flipr Hub  | Filterung (ein/aus), Filtermodus (automatisch, manuell, Zeitplan)                    |

Das Ein- oder Ausschalten der Filterung versetzt den Hub in den manuellen Modus, wie die Flipr-App. Wählen Sie erneut „Automatisch“ oder „Zeitplan“, um dem Hub die Steuerung zurückzugeben.

### Szenen

Auslöser:

- **Flipr: neue Messung**: jede neue Messung, mit allen Werten als Variablen.
- **Flipr: Wasserbewertung geändert**: Die Bewertung von pH oder Chlor hat sich geändert. Filtern Sie nach Parameter und neuer Bewertung („Zu niedrig“ und „Zu hoch“ für einen Alarm).
- **Flipr: seit 24 Stunden keine Messung**: leere Batterie, Wintermodus, Netz. Einmal ausgelöst.
- **Flipr Hub: Filterung umgeschaltet**: Der Hub hat die Pumpe selbst gestartet oder gestoppt (Zeitplan, Automatikmodus, Flipr-App). Nicht ausgelöst durch Befehle aus Gladys.

Aktionen:

- **Flipr: letzte Messung lesen**: Temperatur, pH-Wert, Chlor, Redox, Batterie, Bewertungen und ein fertiger Satz.
- **Flipr Hub: Filtermodus ändern**: automatisch, manuell oder Zeitplan.

Beispiele:

- Wenn die Wasserbewertung auf „Zu niedrig“ oder „Zu hoch“ wechselt → eine Nachricht mit `{{triggerEvent.data.summary}}` senden.
- Wenn es seit 24 Stunden keine Messung gibt → mich erinnern, den Flipr zu prüfen.
- Jeden Abend um 20 Uhr → die letzte Messung lesen und ihre Zusammenfassung senden.

### Widget

Dashboard → Bearbeiten → **Poolwasser** hinzufügen. Wählen Sie den Analysator, den Hub, das Diagramm (Temperatur, pH-Wert, Chlor, Redox oder keins) und seinen Zeitraum. Das Diagramm zeigt den Verlauf, den Gladys speichert: Es erscheint, sobald das Gerät des Analysators hinzugefügt ist.

## Fehlerbehebung

- **„Flipr hat E-Mail oder Passwort abgelehnt“**: Prüfen Sie beides in der Flipr-App, dann in der Konfiguration.
- **Kein Gerät unter Entdecken**: Das Konto hat weder Analysator noch Hub, oder Flipr wurde noch nicht gelesen: Verwenden Sie „Verbindung testen“.
- **„Noch keine Messung“**: Der Flipr ist im Wintermodus oder nicht kalibriert; er misst wieder, sobald er im Wasser und in der Flipr-App kalibriert ist.
- **Werte etwas verspätet**: Flipr misst etwa einmal pro Stunde, und die Integration liest die Cloud standardmäßig alle 15 Minuten.
- **„Die Flipr-Cloud antwortet nicht“ oder „Flipr begrenzt die Anfragen“**: Die Integration versucht es beim nächsten Lesen erneut. Das Unternehmen hinter Flipr wurde 2025 liquidiert, und der Dienst läuft seit 2026 wieder: Wenn das Problem anhält, prüfen Sie, ob die Flipr-App noch funktioniert.
- **Protokolle**: Fügen Sie die Umgebungsvariable `DEBUG=gladys-integration-sdk` hinzu und öffnen Sie ein Issue auf [GitHub](https://github.com/William-De71/gladys-flipr/issues) mit den Versionen von Gladys und der Integration und den Protokollen (das Passwort erscheint nie darin).

Die verwendete API ist die der Flipr-App: Flipr veröffentlicht dazu keine offizielle Dokumentation, und sie kann sich ohne Vorankündigung ändern.
