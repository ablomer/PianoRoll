import { Instrument, NoteData, Position, PositionRefs } from "./types";
import {
    BAR_LENGTH,
    HEADER_HEIGHT,
    NOTES,
    NOTE_HEIGHT,
    NOTE_WIDTH,
    PIANO_WIDTH,
    SCROLL_VALUE,
} from "./constants";
import {
    allNotes,
    idGen,
    audioContext,
    setInstrumentPlayer,
} from "./globals";
import Soundfont, { InstrumentName } from "soundfont-player";
import { Midi } from '@tonejs/midi'
import { MidiJSON } from '@tonejs/midi'
import { midi as getMidiNumber } from 'tonal-note'

export const createNewDefaultLayer = async () => {
    return {
        id: getNewID(),
        name: "New Layer",
        notes: [],
        instrument: {
            name: "acoustic_grand_piano",
            player: await Soundfont.instrument(audioContext, "acoustic_grand_piano"),
            clientName: "Acoustic Grand Piano",
        },
    };
}

export function* idGenerator() {
    let id = 0;
    while (true) {
        yield ++id;
    }
}

export const getPos = (note: NoteData): Position => {
    const x = Math.max(PIANO_WIDTH + note.column * NOTE_WIDTH * 1, PIANO_WIDTH);
    const y = (allNotes.length - note.row - 1) * NOTE_HEIGHT;
    return { x, y };
};

export const getRowFromNote = (note: string) => {
    return allNotes.length - allNotes.indexOf(note) - 1;
};

let currentMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
let currentMouseUpHandler: ((e: MouseEvent) => void) | null = null;

export const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

export const handleNoteMouseEvents = (refs: PositionRefs,
    mouseMoveHandler: (row: number, col: number, e: MouseEvent) => void
) => {
    // If there are already event listeners attached, remove them first.
    if (currentMouseMoveHandler) {
        window.removeEventListener("mousemove", currentMouseMoveHandler);
        //@ts-ignore
        window.removeEventListener("mouseup", currentMouseUpHandler);
    }
    const handleMouseMove = (e: MouseEvent) => {
        const { row, col } = getNoteCoordsFromMousePosition(e, refs);
        const { pianoRollRef, gridRef } = refs;

        const pastWindowWidthRight = e.clientX >= window.innerWidth - 1;
        const pastWindowWidthLeft = e.clientX <= 1;
        const pastWindowHeightTop = e.clientY >= window.innerHeight - 1;
        const pastWindowHeightBottom = e.clientY <= 1;
        const widthScrollValue = pastWindowWidthRight
            ? SCROLL_VALUE
            : pastWindowWidthLeft
                ? -SCROLL_VALUE
                : 0;
        const heightScrollValue = pastWindowHeightTop
            ? SCROLL_VALUE
            : pastWindowHeightBottom
                ? -SCROLL_VALUE
                : 0;

        if (pianoRollRef.current && gridRef.current) {
            pianoRollRef.current.scrollBy(0, heightScrollValue);
            gridRef.current.scrollBy(widthScrollValue, 0);
        }
        mouseMoveHandler(row, col, e);
    };

    const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
    };

    // Save the current handlers so they can be removed later.
    currentMouseMoveHandler = handleMouseMove;
    currentMouseUpHandler = handleMouseUp;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
};

export const getAllNotesFromOctaveCount = (
    octaveCount: number,
    startOctave = 0
): string[] => {
    let result: string[] = [];
    for (let i = startOctave; i < octaveCount; i++) {
        result = result.concat(Object.keys(NOTES).map((note) => `${note}${i}`));
    }
    return result.reverse();
};

export const getHeightOfPianoRoll = () => allNotes.length * NOTE_HEIGHT;

export const getNoteCoordsFromMousePosition = (
    e: React.MouseEvent | MouseEvent,
    refs: PositionRefs,
) => {
    const { x, y } = getMousePos(e, refs);

    const row = Math.min(
        Math.max(allNotes.length - Math.ceil(y / NOTE_HEIGHT), 0),
        allNotes.length - 1
    );
    const col = Math.max(Math.round((x - PIANO_WIDTH) / (NOTE_WIDTH * 1)), 0);
    return { row, col };
};

export const playNote = (player: Instrument['player'], note: string, timeMS = 100) => {
    if (player)
        player.play(note, audioContext.currentTime, {
            duration: timeMS / 1000,
            gain: 5,
        });
};

export const getFrequencyFromNote = (note: string) => {
    const octave = parseInt(note[note.length - 1]);
    const noteName = note.slice(0, -1);
    return (NOTES[noteName] as number) * Math.pow(2, octave);
};

export const makeNewNote = (row: number, col: number, noteLength: number): NoteData => {
    return {
        row: row,
        column: col,
        note: allNotes[allNotes.length - 1 - row],
        units: noteLength,
        velocity: 1,
        pan: 1,
        id: getNewID(),
        selected: false,
        color: undefined,
    };
};

export const snapColumn = (col: number, snapValue: number) => {
    if (col === 0) return 0;
    const mod = col % snapValue;
    if (mod > snapValue / 2) {
        return col + (snapValue - mod);
    }
    return col - mod;
};

export const timer = (ms: number) => {
    return new Promise((res) => {
        const targetTime = audioContext.currentTime + ms / 1000;
        const intervalId = setInterval(() => {
            if (audioContext.currentTime >= targetTime) {
                clearInterval(intervalId);
                // @ts-ignore
                res();
            }
        }, 1);
    });
};

export const getMousePos = (e: MouseEvent | React.MouseEvent, refs: PositionRefs): Position => {
    const { pianoRollRef, gridRef } = refs;
    if (!pianoRollRef.current || !gridRef.current) return { x: 0, y: 0 };
    const x = e.clientX + gridRef.current.scrollLeft
    const y = e.clientY + pianoRollRef.current?.scrollTop - HEADER_HEIGHT;
    return { x, y };
};

export const reanitializeInstrument = async (instrument: InstrumentName) => {
    setInstrumentPlayer(await Soundfont.instrument(audioContext, instrument));
};

export const getNearestBar = (notes: NoteData[]) => {
    if (notes.length === 0) return BAR_LENGTH
    let farthestCol = Math.max(
        ...notes.map((note: NoteData) => note.column + note.units)
    );
    if (farthestCol % BAR_LENGTH !== 0)
        farthestCol += BAR_LENGTH - (farthestCol % BAR_LENGTH);

    return farthestCol;
};

export const midiToNoteData = (midiData: MidiJSON): NoteData[] => {
    const noteData: NoteData[] = [];

    const timeDivision = midiData.header.ppq || 128; // Default PPQ if not specified
    midiData.tracks.forEach(track => {
      // Map with @tonejs/midi's absolute times
      const bpm = midiData.header.tempos[0]?.bpm || 120; // Get BPM
      const secondsPerBeat = 60 / bpm;
      const columnsPerBeat = 8; // Internal grid structure assumption
      const secondsPerColumn = secondsPerBeat / columnsPerBeat;

      track.notes.forEach(note => {
        const midiNumber = note.midi;
        const noteName = allNotes.find(n => {
          const parsedNote = getMidiNumber(n);
          return parsedNote !== null && parsedNote === midiNumber;
        });

        if (noteName) {
           const startColumn = Math.round(note.time / secondsPerColumn);
           const durationUnits = Math.round(note.duration / secondsPerColumn);
           const velocity = Math.round(note.velocity * 127); // Denormalize velocity

           const newNote: NoteData = {
             row: getRowFromNote(noteName),
             note: noteName,
             column: startColumn,
             units: Math.max(1, durationUnits), // Ensure minimum 1 unit duration
             velocity: velocity,
             pan: 0,
             id: getNewID(),
             selected: false,
             color: undefined,
           };
           noteData.push(newNote);
        } else {
            console.warn(`Could not find matching note name for MIDI number: ${midiNumber}`);
        }
      });
    });

    // Sort notes by column, then row (descending for visual top-down)
    noteData.sort((a, b) => {
      if (a.column !== b.column) return a.column - b.column;
      return b.row - a.row; // Higher row index (lower note) first for same column
    });

    return noteData;
};

export const ellipsized = (str: string, maxLength: number) => {
    if (maxLength < 0) return ''
    if (str.length > maxLength) {
        return str.slice(0, maxLength) + "..";
    }
    return str;
}

// Convert notes data to MIDI file and return as a Blob using @tonejs/midi
export const noteDataToMidi = (notes: NoteData[], bpm: number): Blob => {
  const midi = new Midi();
  midi.header.setTempo(bpm);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] }); // Add time signature
  midi.header.name = "PianoRoll Export";

  const track = midi.addTrack();
  track.name = "Piano Roll Layer";

  // Conversion factors
  const secondsPerBeat = 60 / bpm;
  const columnsPerBeat = 8; // Based on midiToNoteData logic
  const secondsPerColumn = secondsPerBeat / columnsPerBeat;

  notes.forEach(note => {
    const midiNumber = getMidiNumber(note.note);
    if (midiNumber === null) {
      console.warn(`Could not convert note ${note.note} to MIDI number. Skipping.`);
      return; // Skip notes that can't be converted
    }

    const startTimeSeconds = note.column * secondsPerColumn;
    const durationSeconds = note.units * secondsPerColumn;
    const velocityNormalized = note.velocity / 127; // Normalize velocity to 0-1 range

    track.addNote({
      midi: midiNumber,
      time: startTimeSeconds,
      duration: durationSeconds,
      velocity: velocityNormalized
    });
  });

  // Return MIDI data as a Blob
  return new Blob([midi.toArray()], { type: 'audio/midi' });
};

export const getNewID = () => idGen.next().value as number;
