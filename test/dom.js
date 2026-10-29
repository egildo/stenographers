// A DOM for the tests: the stenographers read HTML elements and parse markup (`<template>`), which node has no DOM for. happy-dom's window, its document made the global one, as a page's is.
import { Window } from 'happy-dom';

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;
