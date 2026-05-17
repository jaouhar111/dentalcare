import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales — DentalCare",
  description:
    "Informations légales relatives à l'éditeur et à l'hébergeur du logiciel DentalCare.",
};

/**
 * Mentions légales — obligatoires pour tout service en ligne au Maroc
 * (cf. loi n° 53-05 sur l'échange électronique de données juridiques,
 * et la loi 09-08 pour la partie données à caractère personnel).
 *
 * Remplacer les `__placeholders__` par les vraies valeurs avant mise en
 * production. Le contenu doit être validé par un juriste local (cabinet
 * d'avocats à Casablanca ou Fès) avant signature du premier client.
 */
export default function LegalNoticePage() {
  return (
    <>
      <h1>Mentions légales</h1>
      <p className="text-muted-foreground text-sm">
        Dernière mise à jour : <span className="num">{new Date().toLocaleDateString("fr-FR")}</span>
      </p>

      <h2>1. Éditeur du logiciel</h2>
      <p>
        Le logiciel <strong>DentalCare</strong> est édité par :
      </p>
      <ul>
        <li>
          Raison sociale : <strong>__RAISON_SOCIALE__</strong>
        </li>
        <li>
          Forme juridique : <strong>__FORME_JURIDIQUE__</strong> (SARL, SARL AU, SA…)
        </li>
        <li>
          Capital social : <strong>__CAPITAL__</strong> DH
        </li>
        <li>
          Siège social : <strong>__ADRESSE__</strong>, Maroc
        </li>
        <li>
          Registre du commerce (RC) : <strong>__RC__</strong> — Tribunal de commerce de
          <strong> __VILLE_TRIBUNAL__</strong>
        </li>
        <li>
          Identifiant fiscal (IF) : <strong>__IF__</strong>
        </li>
        <li>
          ICE : <strong>__ICE__</strong>
        </li>
        <li>
          Adresse e-mail : <a href="mailto:__EMAIL__">__EMAIL__</a>
        </li>
        <li>
          Téléphone : <span className="num">__TELEPHONE__</span>
        </li>
      </ul>

      <h2>2. Directeur de la publication</h2>
      <p>
        Le directeur de la publication est : <strong>__NOM_DIRECTEUR__</strong>, en qualité de{" "}
        <strong>__FONCTION__</strong>.
      </p>

      <h2>3. Hébergement</h2>
      <p>L'application est hébergée par :</p>
      <ul>
        <li>
          <strong>Vercel Inc.</strong> — 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.
          Site web : <a href="https://vercel.com">vercel.com</a>.
        </li>
        <li>
          Base de données : <strong>Neon Inc.</strong> — 209 Havemeyer St, Brooklyn, NY 11211,
          États-Unis (région européenne <code>eu-central-1</code>, Francfort).
        </li>
        <li>
          Stockage des images médicales : <strong>Cloudinary Inc.</strong> — Santa Clara, CA,
          États-Unis (région EU lorsque sélectionnée).
        </li>
      </ul>
      <p>
        L'éditeur s'engage à maintenir les données des cabinets dentaires marocains au sein
        de l'Union européenne. Aucun transfert vers les États-Unis n'est effectué sans le
        consentement explicite du responsable du cabinet, conformément aux articles 43 et 44
        de la loi 09-08.
      </p>

      <h2>4. Propriété intellectuelle</h2>
      <p>
        L'ensemble du site et de l'application (textes, graphismes, logos, icônes, code source,
        bases de données) est protégé par le droit d'auteur marocain (loi n° 2-00 sur les
        droits d'auteur et droits voisins) et international. Toute reproduction, représentation,
        modification, publication, adaptation, totale ou partielle, par quelque moyen que ce
        soit, sans autorisation préalable et écrite de l'éditeur, est interdite et constitue
        une contrefaçon sanctionnée par les articles 64 à 76 de la loi 2-00.
      </p>

      <h2>5. Loi applicable et juridiction compétente</h2>
      <p>
        Les présentes mentions sont régies par la loi marocaine. En cas de litige et à défaut
        de résolution amiable, les tribunaux compétents du ressort de{" "}
        <strong>__VILLE_TRIBUNAL__</strong> seront seuls compétents.
      </p>

      <h2>6. Contact</h2>
      <p>
        Pour toute question relative à ces mentions ou au fonctionnement de l'application,
        écrivez-nous à <a href="mailto:__EMAIL__">__EMAIL__</a>.
      </p>

      <hr className="my-8 border-slate-200 dark:border-slate-800" />
      <p className="text-xs text-amber-700 dark:text-amber-400">
        <strong>⚠ À compléter avant mise en production.</strong> Les champs marqués
        <code> __PLACEHOLDER__</code> doivent être remplis avec les coordonnées réelles de
        l'éditeur, et le document doit être relu par un juriste marocain (loi 09-08, loi
        53-05, code de commerce).
      </p>
    </>
  );
}
