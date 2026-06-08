/// <reference path="./node_modules/@nativescript/types/index.d.ts" />
/// <reference path="./node_modules/@nativescript/iqkeyboardmanager/typings/index.d.ts" />

declare class AI extends NSObject {

	static alloc(): AI; // inherited from NSObject

	static new(): AI; // inherited from NSObject

	static readonly shared: AI;

	streamResponseFor(prompt: string, onChunk: (p1: string) => void, onComplete: (p1: string | null) => void): void;
}