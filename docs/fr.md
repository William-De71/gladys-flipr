# Flipr

## Présentation

Cette intégration amène dans Gladys votre analyseur de piscine connecté **Flipr** et le **Flipr Hub** :

- un appareil par analyseur : température de l’eau, pH, chlore, redox (ORP), batterie, et l’évaluation du pH et du chlore donnée par Flipr (trop bas, un peu bas, idéal, un peu haut, trop haut) ;
- un appareil par Hub : filtration en marche ou arrêtée et mode de filtration (automatique, manuel, programmation), tous deux pilotables depuis Gladys ;
- des déclencheurs de scène (nouvelle mesure, évaluation de l’eau changée, aucune mesure depuis 24 heures, filtration basculée par le Hub) et des actions de scène (lire la dernière mesure, changer le mode de filtration) ;
- un widget de tableau de bord « Eau de la piscine ».

Flipr n’a pas d’API locale : l’analyseur envoie ses mesures au cloud Flipr environ une fois par heure, et l’intégration les y lit avec votre compte Flipr (transport cloud). Votre e-mail et votre mot de passe ne partent que vers le cloud Flipr, comme avec l’application Flipr.

![Widget Eau de la piscine, une piscine équilibrée et une piscine dont le pH a dérivé (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-flipr/main/docs/assets/widgets.fr.png)

## Prérequis

- Gladys Assistant 5.1.0 ou plus récent.
- Un analyseur Flipr (Start, AnalysR…) qui fonctionne déjà dans l’application mobile Flipr, et éventuellement un Flipr Hub.
- L’e-mail et le mot de passe de votre compte Flipr.

## Configuration

1. Intégrations → Flipr → Configuration.
2. Remplissez les champs, puis enregistrez.

| Champ                       | Description                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| E-mail                      | L’e-mail de votre compte Flipr.                                                                                |
| Mot de passe                | Son mot de passe, enregistré comme secret et jamais réaffiché.                                                 |
| Intervalle de lecture (min) | De 5 à 60 minutes, 15 par défaut. L’analyseur mesure environ une fois par heure : inutile d’aller plus vite.   |
| Langue des textes           | Noms des fonctionnalités, évaluations et résumés des scènes. Automatique : la langue de votre tableau de bord. |

**Tester la connexion** se connecte à Flipr et indique combien d’analyseurs et de Hubs compte le compte.

## Utilisation

### Appareils

Appareils → Flipr → **Découverte**, puis ajoutez l’analyseur (« Flipr AB256C ») et le Hub (« Flipr Hub CD256C »). Leurs valeurs apparaissent à la lecture suivante.

| Appareil  | Fonctionnalités                                                                        |
| --------- | -------------------------------------------------------------------------------------- |
| Analyseur | Température de l’eau, pH, chlore (mg/L), redox (mV), batterie, état du pH et du chlore |
| Flipr Hub | Filtration (marche/arrêt), mode de filtration (automatique, manuel, programmation)     |

Démarrer ou arrêter la filtration met le Hub en mode manuel, comme le fait l’application Flipr. Choisissez à nouveau « Automatique » ou « Programmation » pour rendre la main au Hub.

### Scènes

Déclencheurs :

- **Flipr : nouvelle mesure** : chaque nouvelle mesure, avec toutes ses valeurs en variables.
- **Flipr : évaluation de l’eau changée** : le pH ou le chlore a changé d’évaluation. Filtrez sur le paramètre et sur la nouvelle évaluation (« Trop bas » et « Trop haut » pour une alerte).
- **Flipr : aucune mesure depuis 24 heures** : pile vide, mode hiver, réseau. Déclenché une fois.
- **Flipr Hub : filtration basculée** : le Hub a démarré ou arrêté la pompe de lui-même (programmation, mode automatique, application Flipr). Pas déclenché par les commandes envoyées depuis Gladys.

Actions :

- **Flipr : lire la dernière mesure** : température, pH, chlore, redox, batterie, évaluations et une phrase toute prête.
- **Flipr Hub : changer le mode de filtration** : automatique, manuel ou programmation.

Exemples :

- Quand l’évaluation de l’eau passe à « Trop bas » ou « Trop haut » → envoyer un message avec `{{triggerEvent.data.summary}}`.
- Quand il n’y a aucune mesure depuis 24 heures → me rappeler de vérifier le Flipr.
- Chaque soir à 20 h → lire la dernière mesure, puis envoyer son résumé.

### Widget

Tableau de bord → Modifier → ajoutez **Eau de la piscine**. Choisissez l’analyseur, le Hub, le graphique (température, pH, chlore, redox ou aucun) et sa période. Le graphique montre l’historique que Gladys conserve : il apparaît dès que l’appareil de l’analyseur est ajouté.

## Dépannage

- **« Flipr a refusé l’e-mail ou le mot de passe »** : vérifiez-les dans l’application Flipr, puis dans la configuration.
- **Aucun appareil dans Découverte** : le compte n’a ni analyseur ni Hub, ou Flipr n’a pas encore été lu : utilisez « Tester la connexion ».
- **« Pas encore de mesure »** : le Flipr est en mode hiver ou pas calibré ; il mesure à nouveau une fois remis à l’eau et calibré dans l’application Flipr.
- **Valeurs un peu en retard** : Flipr mesure environ une fois par heure, et l’intégration lit le cloud toutes les 15 minutes par défaut.
- **« Le cloud Flipr ne répond pas » ou « Flipr limite les requêtes »** : l’intégration réessaie à la lecture suivante. La société derrière Flipr a été liquidée en 2025 et le service fonctionne de nouveau depuis 2026 : si le problème dure, vérifiez que l’application Flipr fonctionne encore.
- **Journaux** : ajoutez la variable d’environnement `DEBUG=gladys-integration-sdk`, puis ouvrez une issue sur [GitHub](https://github.com/William-De71/gladys-flipr/issues) avec les versions de Gladys et de l’intégration et les journaux (le mot de passe n’y apparaît jamais).

L’API utilisée est celle de l’application Flipr : Flipr n’en publie aucune documentation officielle, et elle peut changer sans prévenir.
