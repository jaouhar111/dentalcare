import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — DentalCare",
  description:
    "Comment DentalCare collecte, utilise et protège les données personnelles et médicales conformément à la loi 09-08.",
};

/**
 * Politique de confidentialité — exigée par la loi 09-08 (Maroc) article 5
 * pour toute collecte de données à caractère personnel, et renforcée pour
 * les données de santé qui sont des données sensibles (art. 12).
 *
 * À faire valider par un avocat avant production. Les noms d'éditeur,
 * coordonnées CNDP, etc. doivent être complétés.
 */
export default function PrivacyPage() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p className="text-muted-foreground text-sm">
        Dernière mise à jour : <span className="num">{new Date().toLocaleDateString("fr-FR")}</span>
      </p>

      <p>
        La présente politique décrit la manière dont <strong>DentalCare</strong> (ci-après
        « l'Application ») collecte, utilise, conserve et protège les données à caractère
        personnel et les données de santé des patients des cabinets dentaires qui souscrivent
        au service. Elle est rédigée en conformité avec la <strong>loi 09-08</strong>{" "}
        relative à la protection des personnes physiques à l'égard du traitement des données
        à caractère personnel, et le décret n° 2-09-165 pris pour son application.
      </p>

      <h2>1. Responsable de traitement</h2>
      <p>
        Le <strong>responsable du traitement</strong> au sens de l'article 1.6 de la loi
        09-08 est le <strong>cabinet dentaire</strong> qui souscrit à l'Application.
        <strong> DentalCare</strong> (l'éditeur) intervient en qualité de{" "}
        <strong>sous-traitant</strong> au sens de l'article 1.7 — il n'utilise jamais les
        données à des fins propres, ne les revend pas et ne les communique à aucun tiers
        en dehors des cas prévus par la loi (réquisition judiciaire, audit CNDP).
      </p>

      <h2>2. Données collectées</h2>

      <h3>2.1. Données patients (collectées par le cabinet via l'Application)</h3>
      <ul>
        <li>Identité : nom, prénom, CIN, date de naissance, sexe.</li>
        <li>Contact : adresse, ville, téléphone, e-mail.</li>
        <li>
          Données de santé (catégorie sensible — art. 12 loi 09-08) : antécédents médicaux,
          allergies, groupe sanguin, soins reçus, ordonnances, radiographies, photos
          cliniques (avec consentement écrit), odontogramme.
        </li>
        <li>Données de paiement : factures, montants, mode de règlement.</li>
        <li>
          Préférences de communication (canal préféré : WhatsApp, e-mail, téléphone ;
          langue préférée : français, arabe, anglais).
        </li>
      </ul>

      <h3>2.2. Données utilisateurs (personnel du cabinet)</h3>
      <ul>
        <li>Nom complet, e-mail professionnel, rôle (admin, dentiste, réceptionniste).</li>
        <li>
          Empreinte de mot de passe (Argon2id — le mot de passe en clair n'est jamais stocké
          ni transmis sur nos serveurs).
        </li>
        <li>Date/heure de la dernière connexion, adresse IP (anti-bruteforce).</li>
      </ul>

      <h3>2.3. Données techniques (collectées automatiquement)</h3>
      <ul>
        <li>
          Journaux applicatifs (audit) — qui a modifié quoi, quand. Conservés pour la
          durée de rétention médicale (cf. §5).
        </li>
        <li>
          Erreurs anonymisées via le service <strong>Sentry</strong>. Les champs identifiés
          comme sensibles (mots de passe, jetons) sont supprimés avant émission. Les
          captures de session (Replay) masquent par défaut l'intégralité du texte de la page
          et bloquent les médias.
        </li>
      </ul>

      <h2>3. Finalités du traitement</h2>
      <p>Les données sont traitées exclusivement pour :</p>
      <ul>
        <li>Tenir le dossier médical du patient et planifier ses rendez-vous.</li>
        <li>Émettre des factures, ordonnances, plans de paiement échelonnés.</li>
        <li>
          Envoyer des rappels de rendez-vous, de paiements et de suivis cliniques via
          WhatsApp ou e-mail, selon le canal choisi par le patient (consentement implicite
          à l'inscription, retractable à tout moment).
        </li>
        <li>Assurer la sécurité de l'application (anti-bruteforce, audit, sauvegardes).</li>
        <li>Honorer les obligations légales (loi 09-08, fiscalité, conservation médicale).</li>
      </ul>
      <p>
        En aucun cas les données ne sont utilisées à des fins de profilage commercial, de
        publicité ciblée, de revente ou de cession à des tiers.
      </p>

      <h2>4. Base légale</h2>
      <ul>
        <li>
          <strong>Exécution du contrat de soin</strong> entre le patient et le cabinet
          (art. 4.5 loi 09-08).
        </li>
        <li>
          <strong>Obligation légale</strong> du cabinet de tenir un dossier médical
          (art. 11 loi 09-08, code de déontologie médicale).
        </li>
        <li>
          <strong>Consentement explicite</strong> pour les photos cliniques (art. 12.2),
          confirmé via la case <em>« Consentement photos »</em> à l'inscription.
        </li>
      </ul>

      <h2>5. Durée de conservation</h2>
      <ul>
        <li>
          <strong>Données médicales</strong> : 10 ans à compter du dernier acte. Pour un
          patient mineur : 10 ans ou jusqu'à ses 28 ans, selon la plus longue échéance.
        </li>
        <li>
          <strong>Données comptables</strong> (factures, paiements) : 10 ans
          conformément à l'article 22 du code de commerce marocain.
        </li>
        <li>
          <strong>Journaux d'audit</strong> : 5 ans après l'évènement, puis archivés sous
          forme tombstone (suppression du contenu, conservation de l'horodatage).
        </li>
        <li>
          <strong>Données utilisateurs</strong> (personnel) : durée du contrat de travail +
          1 an.
        </li>
      </ul>

      <h2>6. Sécurité</h2>
      <p>L'Application met en œuvre les mesures techniques suivantes :</p>
      <ul>
        <li>Chiffrement TLS 1.3 entre le navigateur et nos serveurs.</li>
        <li>Chiffrement au repos (AES-256) de la base de données chez Neon.</li>
        <li>
          Hachage Argon2id des mots de passe (résistant aux attaques par dictionnaire et
          GPU).
        </li>
        <li>
          Limitation du taux de tentatives de connexion (5 essais / 15 minutes par IP +
          e-mail).
        </li>
        <li>
          Audit logging exhaustif de toute opération sensible (création/suppression
          patient, émission facture, export RGPD).
        </li>
        <li>Sauvegardes journalières chiffrées de la base, conservées 30 jours.</li>
      </ul>

      <h2>7. Droits des personnes (loi 09-08 art. 7 à 9)</h2>
      <p>Conformément à la loi 09-08, chaque patient dispose des droits suivants :</p>
      <ul>
        <li>
          <strong>Droit d'accès</strong> (art. 7) — Le patient peut demander à recevoir
          l'intégralité des données le concernant. L'Application fournit un export ZIP
          téléchargeable depuis la fiche patient (bouton <em>« Export RGPD »</em>).
        </li>
        <li>
          <strong>Droit de rectification</strong> (art. 8) — Le patient peut demander la
          correction de toute donnée inexacte. Le cabinet dispose d'un mois pour répondre.
        </li>
        <li>
          <strong>Droit d'opposition</strong> (art. 9) — Le patient peut s'opposer à
          recevoir des rappels (rendez-vous, suivis). Décocher le canal de communication
          préféré dans la fiche patient suffit.
        </li>
        <li>
          <strong>Droit à l'effacement</strong> (art. 8 al. 3) — Le patient peut demander
          la suppression définitive de ses données. Le cabinet (administrateur) peut
          procéder à cette suppression depuis la fiche patient (bouton{" "}
          <em>« Effacer RGPD »</em>). L'opération est irréversible et tracée.
        </li>
      </ul>
      <p>
        Pour exercer un de ces droits, le patient s'adresse directement à son cabinet
        dentaire (responsable du traitement). En cas de litige, il peut saisir la{" "}
        <strong>Commission Nationale de contrôle de la protection des Données à
        caractère Personnel (CNDP)</strong> à l'adresse{" "}
        <a href="https://www.cndp.ma">www.cndp.ma</a>.
      </p>

      <h2>8. Cookies</h2>
      <p>
        L'Application utilise uniquement des cookies fonctionnels nécessaires à
        l'authentification (cookie de session <code>__Secure-next-auth.session-token</code>).
        Aucun cookie publicitaire, de mesure d'audience tierce ou de traçage cross-site
        n'est déposé.
      </p>

      <h2>9. Modifications</h2>
      <p>
        L'éditeur peut modifier la présente politique pour refléter une évolution légale
        ou technique. Les utilisateurs et patients seront informés des modifications
        substantielles par e-mail au moins 30 jours avant leur entrée en vigueur.
      </p>

      <h2>10. Contact</h2>
      <p>
        Délégué à la protection des données :{" "}
        <a href="mailto:__DPO_EMAIL__">__DPO_EMAIL__</a>.
      </p>

      <hr className="my-8 border-slate-200 dark:border-slate-800" />
      <p className="text-xs text-amber-700 dark:text-amber-400">
        <strong>⚠ À compléter avant mise en production.</strong> Cette politique est un
        modèle à valider par un juriste marocain et à compléter avec les coordonnées
        CNDP correspondant à votre déclaration de traitement.
      </p>
    </>
  );
}
