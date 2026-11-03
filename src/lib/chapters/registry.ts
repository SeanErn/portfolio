import type { Component } from 'svelte';
import Speechify from './Speechify.svelte';
import QuestNav from './QuestNav.svelte';
import Frc from './Frc.svelte';
import Cfa from './Cfa.svelte';
import Otsego from './Otsego.svelte';
import Gatech from './Gatech.svelte';
import Skills from './Skills.svelte';
import Bom from './Bom.svelte';
import Contact from './Contact.svelte';
import type { ChapterId } from '../content';

/** Chapter components in page order, keyed by chapter id. */
export const registry: Record<ChapterId, Component> = {
	speechify: Speechify,
	questnav: QuestNav,
	frc: Frc,
	cfa: Cfa,
	otsego: Otsego,
	gatech: Gatech,
	skills: Skills,
	bom: Bom,
	contact: Contact
};
