import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { Section, A } from "@/components/legal/LegalBits";
import { LEGAL } from "@/lib/legal-entity";
import { MapSourcesTable } from "@/features/maps/presentation/MapSourcesTable";

export const metadata: Metadata = {
  alternates: { canonical: "/maps/sources" },
  title: "Map sources and licences",
  description: "Where the DonorDesk maps get their streets, place names and boundaries from, who made them, and under which licence you may reuse them.",
};

const TOC = [
  { id: "basemap", title: "Streets and place names" },
  { id: "boundaries", title: "Boundaries" },
  { id: "share-alike", title: "Files we offer under the same licence" },
  { id: "files", title: "Every boundary file" },
  { id: "contact", title: "Corrections" },
];

const P = ({ children }: { children: React.ReactNode }) => <p className="mb-3 text-sm leading-relaxed text-slate-300">{children}</p>;

export default function MapSourcesPage() {
  return (
    <LegalLayout title="Map sources and licences" subtitle="Maps" updated={LEGAL.updated} toc={TOC}>
      <Section id="basemap" title="1. Streets and place names">
        <P>
          The street and terrain map is drawn from OpenStreetMap data, © <A href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</A>, available under
          the Open Database Licence, in a build by <A href="https://protomaps.com">Protomaps</A>. We serve it from our own servers: opening a map does not send your
          location, your projects or your places to any outside map service.
        </P>
        <P>
          The map labels use the Noto Sans typeface (SIL Open Font Licence) and, for Arabic, MapLibre&apos;s right-to-left text plugin by Mapbox (BSD 2-clause licence),
          which we also host ourselves.
        </P>
      </Section>
      <Section id="boundaries" title="2. Boundaries">
        <P>
          Country and province outlines are from Natural Earth, which is in the public domain. Districts and finer boundaries come from the United Nations
          Office for the Coordination of Humanitarian Affairs (OCHA) common operational datasets for administrative boundaries, published on the Humanitarian Data
          Exchange, and from geoBoundaries (William &amp; Mary geoLab), whichever is available and more recent for the country and level. Each file keeps the
          name of its maker, its licence and the year it represents; they are listed below, and the map names the source of the level you are looking at.
        </P>
        <P>
          Boundaries are simplified so they draw quickly. They are meant for finding where work happens and showing results by place, not for surveying or for
          settling a border: they do not express any view on the status of a territory.
        </P>
        <P>An organisation can also upload its own boundaries for a country and level. Those are shown only to that organisation, and the map says so.</P>
      </Section>
      <Section id="share-alike" title="3. Files we offer under the same licence">
        <P>
          Some sources are licensed so that anything made from them must be offered under the same licence (the Open Database Licence and Creative Commons
          Attribution-ShareAlike). We have simplified those files and re-coded them for the maps, so the copies we use are derived files, and we offer each of them
          under the licence of its source. They are marked in the list below with a download link. Our application, and the figures drawn on the map, are not part of
          those files and remain ours and yours.
        </P>
      </Section>
      <Section id="files" title="4. Every boundary file">
        <MapSourcesTable />
      </Section>
      <Section id="contact" title="5. Corrections">
        <P>If a credit is wrong or a boundary is, write to <A href={`mailto:${LEGAL.legalEmail}`}>{LEGAL.legalEmail}</A> and we will correct it.</P>
      </Section>
    </LegalLayout>
  );
}
