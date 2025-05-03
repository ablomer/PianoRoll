import { useContext, useState } from "react";
import ClickAwayListener from "react-click-away-listener";
import { LayersContext } from "../../utils/context";
import { optimizeVoiceLeading, pitchToNoteName } from "../../utils/theory-functions";
import { Layer, NoteData } from "../../utils/types";
import { midi as getMidiNumber } from 'tonal-note';
import { allNotes } from "../../utils/globals";

// Import the Note interface from theory-functions
interface Note {
  pitch: number;
  position: number;
  duration: number;
  voice?: number;
}

interface OptimizeHarmonyDialogProps {
  open: boolean;
  onClose: () => void;
}

export const OptimizeHarmonyDialog = ({
  open,
  onClose,
}: OptimizeHarmonyDialogProps): JSX.Element => {
  const { layers, setLayers } = useContext(LayersContext);
  const [melodyLayerId, setMelodyLayerId] = useState<number | string>("");
  const [harmonyLayerId, setHarmonyLayerId] = useState<number | string>("");

  if (!open) return <></>;

  // Get the layer options directly from the layers array
  const layerOptions = layers.map((layer: Layer) => ({
    id: layer.id,
    name: layer.name,
  }));

  const handleOptimize = () => {
    if (!melodyLayerId || !harmonyLayerId) return;

    // Find the actual Layer objects using their IDs
    const melodyLayer = layers.find((l: Layer) => l.id === melodyLayerId);
    const harmonyLayer = layers.find((l: Layer) => l.id === harmonyLayerId);

    if (!melodyLayer || !harmonyLayer) return; // Layers not found

    // Extract melody and harmony notes
    const melodyNotes: Note[] = melodyLayer.notes.map((n: NoteData) => ({
        pitch: getMidiNumber(n.note),
        position: n.column,
        duration: n.units
    }));
    const harmonyNotes: Note[] = harmonyLayer.notes.map((n: NoteData) => ({
        pitch: getMidiNumber(n.note),
        position: n.column,
        duration: n.units
    }));


    // Apply voice leading optimization
    const optimizedNotes = optimizeVoiceLeading(melodyNotes, harmonyNotes);

    // Update the notes with optimized voice leading
    // Find the index of the harmony layer to update
    const harmonyLayerIndex = layers.findIndex((l: Layer) => l.id === harmonyLayerId);
    if (harmonyLayerIndex === -1) return; // Harmony layer not found

    const updatedLayers = [...layers];

    // Convert optimized notes back to NoteData format
    const optimizedHarmonyNotesData: NoteData[] = optimizedNotes
      .filter(
        (note: Note) => !melodyNotes.some(
          (mn: Note) => mn.pitch === note.pitch && mn.position === note.position
        )
      )
      .map((note: Note): NoteData | null => { // Allow returning null if note is out of range
        const optimizedNoteName = pitchToNoteName(note.pitch);
        const noteIndex = allNotes.indexOf(optimizedNoteName);

        // If the optimized note is outside the visual range of the piano roll, skip it
        if (noteIndex === -1) {
            console.warn(`Optimized note ${optimizedNoteName} (pitch ${note.pitch}) is outside the displayable range.`);
            return null;
        }

        // Calculate row index based on reversed allNotes array
        const rowIndex = allNotes.length - 1 - noteIndex;

        return {
            row: rowIndex,
            column: note.position,
            units: note.duration,
            note: optimizedNoteName,
            velocity: 100,
            pan: 0,
            id: Math.random(), // Potential improvement area
            selected: false,
        };
      })
      .filter((n): n is NoteData => n !== null); // Filter out any null values

    updatedLayers[harmonyLayerIndex] = {
      ...updatedLayers[harmonyLayerIndex],
      notes: optimizedHarmonyNotesData,
    };

    setLayers(updatedLayers); // Update the layers in context
    onClose();
  };

  return (
    <ClickAwayListener onClickAway={onClose}>
      <div className="absolute z-10 p-4 -translate-x-1/2 -translate-y-1/2 bg-white rounded-md shadow-lg dark:bg-slate-700 top-1/2 left-1/2">
        <h2 className="mb-4 text-lg font-bold dark:text-white">Optimize Voice Leading</h2>

        <div className="mb-4">
          <label className="block mb-2 text-sm font-medium dark:text-white">
            Select Melody Layer:
          </label>
          <select
            className="w-full p-2 border rounded dark:bg-slate-600 dark:text-white dark:border-slate-500"
            value={melodyLayerId}
            onChange={(e) => setMelodyLayerId(Number(e.target.value))} // Store ID
          >
            <option value="">Select a layer</option>
            {layerOptions.map((layer: { id: number; name: string }) => (
              <option key={`melody-${layer.id}`} value={layer.id}> {/* Use ID */}
                {layer.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-2 text-sm font-medium dark:text-white">
            Select Harmony Layer:
          </label>
          <select
            className="w-full p-2 border rounded dark:bg-slate-600 dark:text-white dark:border-slate-500"
            value={harmonyLayerId}
            onChange={(e) => setHarmonyLayerId(Number(e.target.value))} // Store ID
          >
            <option value="">Select a layer</option>
            {layerOptions.map((layer: { id: number; name: string }) => (
              <option key={`harmony-${layer.id}`} value={layer.id}> {/* Use ID */}
                {layer.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end">
          <button
            className="px-4 py-2 mr-2 text-white bg-gray-500 rounded hover:bg-gray-600"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600"
            onClick={handleOptimize}
            disabled={!melodyLayerId || !harmonyLayerId || melodyLayerId === harmonyLayerId} // Compare IDs
          >
            Optimize
          </button>
        </div>
      </div>
    </ClickAwayListener>
  );
} 