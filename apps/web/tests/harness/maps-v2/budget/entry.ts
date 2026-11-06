// The subject of the size budget: what any screen with a map pulls in (the shared map services). The map library, the tile reader and the
// drawing library are loaded on demand from inside the adapters; this file only keeps them reachable, as the app does.
import { createMapServices } from "@/features/maps/composition";

const services = createMapServices();
(window as unknown as { __services: unknown }).__services = services;
void services.createRenderer;
void services.createDrawingTool;
