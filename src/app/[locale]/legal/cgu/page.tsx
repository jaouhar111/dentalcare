import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CGU — DentalCare",
  description:
    "Conditions générales d'utilisation du logiciel DentalCare par les cabinets dentaires.",
};

/**
 * Conditions Générales d'Utilisation — contrat entre l'éditeur du SaaS et
 * le cabinet qui souscrit. À acheviné devant un juriste avant signature
 * du premier client (sections sensibles : limitation de responsabilité,
 * disponibilité, RGPD/CNDP, droit applicable).
 */
export default function CguPage() {
  return (
    <>
      <h1>Conditions générales d'utilisation</h1>
      <p className="text-muted-foreground text-sm">
        Dernière mise à jour : <span className="num">{new Date().toLocaleDateString("fr-FR")}</span>
      </p>

      <h2>1. Objet</h2>
      <p>
        Les présentes Conditions Générales d'Utilisation (« CGU ») définissent les modalités
        d'utilisation du logiciel <strong>DentalCare</strong> (« le Service »), édité par{" "}
        <strong>__RAISON_SOCIALE__</strong> (« l'Éditeur »), par les cabinets dentaires
        souscripteurs (« le Cabinet »).
      </p>

      <h2>2. Description du service</h2>
      <p>
        Le Service est un logiciel en mode SaaS (Software-as-a-Service) permettant à un
        cabinet dentaire de gérer ses patients, rendez-vous, soins, factures, ordonnances,
        stock et rappels. Le Service est accessible depuis tout navigateur récent.
      </p>

      <h2>3. Inscription et compte</h2>
      <p>
        L'utilisation du Service nécessite la création d'un compte administrateur lors de
        la souscription. Le Cabinet est seul responsable :
      </p>
      <ul>
        <li>De la véracité des informations fournies à l'inscription ;</li>
        <li>
          De la confidentialité de ses identifiants (e-mail + mot de passe) ; tout accès au
          Service depuis le compte est réputé effectué par le Cabinet ;
        </li>
        <li>
          De la création des comptes secondaires pour son personnel (dentistes,
          réceptionnistes) et de la définition de leurs droits.
        </li>
      </ul>
      <p>
        L'Éditeur ne saurait être tenu responsable d'un accès frauduleux au compte du
        Cabinet résultant d'une fuite de mot de passe imputable à ce dernier.
      </p>

      <h2>4. Engagements du Cabinet</h2>
      <p>Le Cabinet s'engage à :</p>
      <ul>
        <li>
          Utiliser le Service conformément à la législation marocaine, notamment la
          <strong> loi 09-08</strong> sur la protection des données personnelles, la{" "}
          <strong>loi 31-08</strong> sur la protection du consommateur, et le code de
          déontologie médicale ;
        </li>
        <li>
          Recueillir le consentement explicite des patients pour le traitement de leurs
          données dans le Service, en particulier pour les photos cliniques ;
        </li>
        <li>
          Ne pas tenter de contourner les mécanismes de sécurité, d'extraire massivement
          les données par scraping, ou de revendre l'accès au Service à des tiers ;
        </li>
        <li>
          Notifier l'Éditeur dans un délai de 24h en cas de suspicion de compromission de
          ses identifiants ou de fuite de données.
        </li>
      </ul>

      <h2>5. Engagements de l'Éditeur</h2>
      <p>L'Éditeur s'engage à :</p>
      <ul>
        <li>
          Maintenir une disponibilité moyenne mensuelle du Service supérieure à{" "}
          <strong>99 %</strong> hors maintenances planifiées (notifiées par e-mail au moins
          48h à l'avance) ;
        </li>
        <li>
          Conserver les données du Cabinet dans une base de données hébergée au sein de
          l'Union européenne (région <code>eu-central-1</code> de Neon) ;
        </li>
        <li>Effectuer des sauvegardes journalières chiffrées, conservées 30 jours ;</li>
        <li>
          Notifier le Cabinet sous 72h en cas de violation de données personnelles, et
          en informer la CNDP conformément à l'article 30 de la loi 09-08 ;
        </li>
        <li>
          Restituer l'intégralité des données du Cabinet dans un format réutilisable (zip
          JSON + PDF) en cas de résiliation, dans un délai de 30 jours.
        </li>
      </ul>

      <h2>6. Tarification et facturation</h2>
      <p>
        Le Service est proposé en <strong>essai gratuit de 30 jours</strong>, puis sur la
        base d'un abonnement mensuel ou annuel à régler d'avance. Les tarifs en vigueur
        sont publiés sur le site et révisables avec un préavis de 30 jours. Toute somme
        impayée à 30 jours peut entraîner la suspension de l'accès, puis la résiliation
        de plein droit après mise en demeure restée sans réponse 15 jours.
      </p>

      <h2>7. Propriété des données</h2>
      <p>
        Le Cabinet conserve la <strong>pleine propriété</strong> de toutes les données
        qu'il importe ou crée dans le Service (fiches patients, rendez-vous, soins,
        factures, etc.). L'Éditeur dispose uniquement d'un droit d'usage temporaire à
        l'effet de fournir le Service.
      </p>

      <h2>8. Propriété intellectuelle du Service</h2>
      <p>
        Le code source, l'interface, les marques et logos du Service sont la propriété
        exclusive de l'Éditeur (loi marocaine 2-00 sur les droits d'auteur). Le Cabinet
        bénéficie d'un droit d'utilisation non exclusif et non cessible pendant la durée
        de l'abonnement.
      </p>

      <h2>9. Limitation de responsabilité</h2>
      <p>
        L'Éditeur ne saurait être tenu responsable :
      </p>
      <ul>
        <li>
          De l'usage qui est fait du Service par le Cabinet ou son personnel (saisies
          erronées, factures émises à tort, etc.) ;
        </li>
        <li>
          Des conséquences d'une interruption temporaire causée par un événement de force
          majeure (coupure d'électricité, défaillance d'un fournisseur tiers,
          cyber-attaque massive) ;
        </li>
        <li>
          De la perte de données résultant d'une utilisation contraire aux CGU ou d'une
          suppression volontaire par le Cabinet.
        </li>
      </ul>
      <p>
        La responsabilité maximale de l'Éditeur, tous préjudices confondus, est limitée
        au montant des sommes effectivement versées par le Cabinet sur les 12 mois
        précédant l'évènement générateur.
      </p>

      <h2>10. Résiliation</h2>
      <p>
        Chaque partie peut résilier l'abonnement à tout moment avec un préavis de 30
        jours. L'Éditeur peut résilier sans préavis en cas de :
      </p>
      <ul>
        <li>Non-paiement persistant après mise en demeure ;</li>
        <li>Violation grave des présentes CGU ;</li>
        <li>Comportement portant atteinte à l'intégrité du Service ou de tiers.</li>
      </ul>
      <p>
        Dans tous les cas, le Cabinet bénéficie d'un délai de 30 jours après la
        résiliation pour télécharger ses données. Passé ce délai, l'Éditeur procède à
        leur suppression définitive.
      </p>

      <h2>11. Droit applicable et juridiction</h2>
      <p>
        Les présentes CGU sont régies par le <strong>droit marocain</strong>. À défaut
        de règlement amiable, les tribunaux du ressort de <strong>__VILLE_TRIBUNAL__</strong>{" "}
        sont seuls compétents.
      </p>

      <hr className="my-8 border-slate-200 dark:border-slate-800" />
      <p className="text-xs text-amber-700 dark:text-amber-400">
        <strong>⚠ À compléter avant mise en production.</strong> Document à valider par
        un avocat marocain — sections critiques : limitation de responsabilité (art. 9),
        conditions de résiliation (art. 10), SLA (art. 5).
      </p>
    </>
  );
}
