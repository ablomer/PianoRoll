// Define types for our music theory algorithm
interface Note {
    pitch: number;       // MIDI pitch (0-127)
    position: number;    // Position in 32nd notes
    duration: number;    // Duration in 32nd notes
    voice?: number;      // Voice assignment
  }
  
  interface Chord {
    position: number;    // Position in 32nd notes
    notes: Note[];       // Notes in the chord
    duration: number;    // Duration of the chord
  }
  
  /**
   * Main function to optimize voice leading
   * @param melodyNotes Array of melody notes (fixed, cannot be changed)
   * @param harmonyNotes Array of harmony notes (can be moved to different octaves)
   * @returns Optimized array of all notes with voice assignments
   */
  function optimizeVoiceLeading(melodyNotes: Note[], harmonyNotes: Note[]): Note[] {
    // 1. Group notes into chords by position
    const chords = identifyChords(melodyNotes, harmonyNotes);
    
    // 2. Determine number of voices based on the maximum number of notes in any chord
    const numVoices = determineVoiceCount(chords);
    
    // 3. Assign voices to the first chord
    assignVoicesToFirstChord(chords[0], numVoices);
    
    // 4. Optimize voice leading for subsequent chords
    for (let i = 1; i < chords.length; i++) {
      optimizeChordVoicing(chords[i - 1], chords[i], numVoices);
    }
    
    // 6. Adjust overall harmony octave relative to melody
    adjustHarmonyOctaveRelativeToMelody(chords);

    // 7. Flatten chords back to notes array
    return flattenChordsToNotes(chords);
  }
  
  /**
   * Group notes into chords by their position
   */
  function identifyChords(melodyNotes: Note[], harmonyNotes: Note[]): Chord[] {
    const allNotes = [...melodyNotes, ...harmonyNotes];
    const positions = new Set<number>();
    
    // Get all unique positions
    allNotes.forEach(note => positions.add(note.position));
    
    // Sort positions chronologically
    const sortedPositions = Array.from(positions).sort((a, b) => a - b);
    
    // Group notes by position to form chords
    const chords: Chord[] = [];
    
    for (let i = 0; i < sortedPositions.length; i++) {
      const position = sortedPositions[i];
      const nextPosition = sortedPositions[i + 1] || Infinity;
      
      const chordNotes = allNotes.filter(note => note.position === position);
      
      // Calculate chord duration (until the next chord)
      const duration = nextPosition - position;
      
      // Mark melody notes so we know they're fixed
      chordNotes.forEach(note => {
        if (melodyNotes.some(m => m.pitch === note.pitch && m.position === note.position)) {
          note.voice = 0; // Melody is always voice 0
        }
      });
      
      chords.push({
        position,
        notes: chordNotes,
        duration
      });
    }
    
    return chords;
  }
  
  /**
   * Determine the number of voices needed based on the chord with the most notes
   */
  function determineVoiceCount(chords: Chord[]): number {
    let maxNotes = 0;
    for (const chord of chords) {
      maxNotes = Math.max(maxNotes, chord.notes.length);
    }
    return maxNotes;
  }
  
  /**
   * Assign voices to the first chord
   * Melody gets voice 0 (top voice), bass gets the highest voice number (bottom)
   */
  function assignVoicesToFirstChord(chord: Chord, numVoices: number): void {
    // Find the melody note (should already have voice=0)
    const melodyNote = chord.notes.find(note => note.voice === 0);
    
    // Sort remaining notes by pitch (descending)
    const remainingNotes = chord.notes
      .filter(note => note.voice === undefined)
      .sort((a, b) => b.pitch - a.pitch);
    
    // Assign voices from top to bottom
    let currentVoice = melodyNote ? 1 : 0;
    
    for (let i = 0; i < remainingNotes.length; i++) {
      // Ensure we're not assigning the bottom voice to anything but the lowest note
      if (i === remainingNotes.length - 1) {
        remainingNotes[i].voice = numVoices - 1; // Bass is always the bottom voice
      } else {
        remainingNotes[i].voice = currentVoice++;
      }
    }
  }
  
  /**
   * Check if two intervals create parallel fifths or octaves
   */
  function isParallelFifthOrOctave(interval1: number, interval2: number): boolean {
    // Perfect fifth = 7 semitones, octave = 12 semitones
    return (interval1 % 12 === 7 && interval2 % 12 === 7) || 
           (interval1 % 12 === 0 && interval2 % 12 === 0 && interval1 !== 0);
  }
  
  /**
   * Calculate the cost of a voice assignment based on voice leading principles
   */
  function calculateVoiceLeadingCost(prevChord: Chord, currentChord: Chord, voiceAssignments: number[]): number {
    let cost = 0;
    const assignedNotes = [...currentChord.notes];
    
    // Assign the proposed voice assignments
    for (let i = 0; i < voiceAssignments.length; i++) {
      assignedNotes[i].voice = voiceAssignments[i];
    }
    
    // Sort both chords by voice for comparison
    const prevSorted = [...prevChord.notes].sort((a, b) => (a.voice || 0) - (b.voice || 0));
    const currentSorted = [...assignedNotes].sort((a, b) => (a.voice || 0) - (b.voice || 0));
    
    // Check for voice crossing
    for (let i = 0; i < currentSorted.length; i++) {
      for (let j = i + 1; j < currentSorted.length; j++) {
        if ((currentSorted[i].voice || 0) < (currentSorted[j].voice || 0) && 
            currentSorted[i].pitch < currentSorted[j].pitch) {
          cost += 1000; // Heavy penalty for voice crossing
        }
      }
    }
    
    // Check for voice spacing (more than an octave apart)
    for (let i = 0; i < currentSorted.length - 1; i++) {
      if (currentSorted[i].pitch - currentSorted[i + 1].pitch > 12) {
        cost += 100; // Penalty for voices more than an octave apart
      }
    }
    
    // Check for parallel fifths and octaves
    for (let i = 0; i < prevSorted.length; i++) {
      for (let j = i + 1; j < prevSorted.length; j++) {
        const prevInterval = Math.abs(prevSorted[i].pitch - prevSorted[j].pitch);
        
        // Find the corresponding voices in the current chord
        const currentVoiceI = currentSorted.findIndex(n => n.voice === prevSorted[i].voice);
        const currentVoiceJ = currentSorted.findIndex(n => n.voice === prevSorted[j].voice);
        
        if (currentVoiceI !== -1 && currentVoiceJ !== -1) {
          const currentInterval = Math.abs(currentSorted[currentVoiceI].pitch - currentSorted[currentVoiceJ].pitch);
          
          if (isParallelFifthOrOctave(prevInterval, currentInterval)) {
            cost += 500; // Heavy penalty for parallel fifths/octaves
          }
        }
      }
    }
    
    // Calculate voice movement cost (smaller movement is better)
    for (let i = 0; i < prevSorted.length; i++) {
      const prevVoice = prevSorted[i].voice;
      const currentVoiceIdx = currentSorted.findIndex(n => n.voice === prevVoice);
      
      if (currentVoiceIdx !== -1) {
        const movement = Math.abs(prevSorted[i].pitch - currentSorted[currentVoiceIdx].pitch);
        cost += movement * 2; // Cost proportional to the movement distance
      }
    }
    
    return cost;
  }
  
  /**
   * Generate all possible voice assignments for a chord
   */
  function generateVoiceAssignments(chord: Chord, numVoices: number): number[][] {
    // Find notes with fixed voices (melody)
    const fixedNotes = chord.notes.filter(note => note.voice !== undefined);
    const unfixedNotes = chord.notes.filter(note => note.voice === undefined);
    
    // Get available voices (excluding already assigned ones)
    const usedVoices = new Set(fixedNotes.map(note => note.voice));
    const availableVoices = Array.from({ length: numVoices }, (_, i) => i)
      .filter(voice => !usedVoices.has(voice));
    
    // Find all permutations of voice assignments
    return generatePermutations(availableVoices, unfixedNotes.length);
  }
  
  /**
   * Generate all permutations of k elements from an array
   */
  function generatePermutations(array: number[], k: number): number[][] {
    const result: number[][] = [];
    
    function backtrack(start: number, current: number[]) {
      if (current.length === k) {
        result.push([...current]);
        return;
      }
      
      for (let i = 0; i < array.length; i++) {
        if (!current.includes(array[i])) {
          current.push(array[i]);
          backtrack(i + 1, current);
          current.pop();
        }
      }
    }
    
    backtrack(0, []);
    return result;
  }
  
  /**
   * Optimize the voicing of a chord based on the previous chord
   */
  function optimizeChordVoicing(prevChord: Chord, currentChord: Chord, numVoices: number): void {
    // Find notes with fixed voices (melody)
    const fixedNotes = currentChord.notes.filter(note => note.voice !== undefined);
    const unfixedNotes = currentChord.notes.filter(note => note.voice === undefined);
    
    // If there are no unfixed notes, nothing to optimize
    if (unfixedNotes.length === 0) return;
    
    // Generate all possible voice assignments
    const possibleAssignments = generateVoiceAssignments(currentChord, numVoices);
    
    // Find the assignment with the lowest cost
    let bestAssignment: number[] | null = null;
    let lowestCost = Infinity;
    
    for (const assignment of possibleAssignments) {
      // Create a temporary voice assignment
      for (let i = 0; i < unfixedNotes.length; i++) {
        unfixedNotes[i].voice = assignment[i];
      }
      
      // Calculate the cost of this assignment
      const cost = calculateVoiceLeadingCost(prevChord, currentChord, assignment);
      
      if (cost < lowestCost) {
        lowestCost = cost;
        bestAssignment = [...assignment];
      }
      
      // Reset voices for next iteration
      unfixedNotes.forEach(note => note.voice = undefined);
    }
    
    // Apply the best assignment
    if (bestAssignment) {
      for (let i = 0; i < unfixedNotes.length; i++) {
        unfixedNotes[i].voice = bestAssignment[i];
      }
    }
    
    // Additional step: Adjust octaves to ensure bass is at the bottom
    adjustOctaves(currentChord);
  }
  
  /**
   * Adjust octaves to ensure proper voice order and bass at bottom
   */
  function adjustOctaves(chord: Chord): void {
    // Sort notes by voice
    chord.notes.sort((a, b) => (a.voice || 0) - (b.voice || 0));
    
    // Find the bass note (should be the highest voice number)
    const bassVoice = Math.max(...chord.notes.map(note => note.voice || 0));
    const bassNote = chord.notes.find(note => note.voice === bassVoice);
    
    if (!bassNote) return;
    
    // Ensure the bass note is the lowest pitch
    let lowestPitch = Math.min(...chord.notes.map(note => note.pitch));
    if (bassNote.pitch !== lowestPitch) {
      // Move the bass down by octaves until it's the lowest
      while (bassNote.pitch > lowestPitch) {
        bassNote.pitch -= 12;
      }
    }
    
    // Adjust other voices to maintain proper ordering
    for (let i = chord.notes.length - 2; i >= 0; i--) {
      const currentNote = chord.notes[i];
      const lowerNote = chord.notes[i + 1];
      
      // If current note is lower than the next voice, move it up an octave
      if (currentNote.pitch <= lowerNote.pitch) {
        const octavesToMove = Math.floor((lowerNote.pitch - currentNote.pitch) / 12) + 1;
        currentNote.pitch += 12 * octavesToMove;
      }
      
      // Ensure voices are within an octave of each other
      if (currentNote.pitch - lowerNote.pitch > 12) {
        currentNote.pitch -= 12 * Math.floor((currentNote.pitch - lowerNote.pitch) / 12);
      }
    }
  }
  
  /**
   * Flatten the chord structure back to an array of notes
   */
  function flattenChordsToNotes(chords: Chord[]): Note[] {
    const notes: Note[] = [];
    for (const chord of chords) {
      for (const note of chord.notes) {
        notes.push({...note});
      }
    }
    return notes;
  }
  
  /**
   * Utility function to convert MIDI pitch to note name
   */
  function pitchToNoteName(pitch: number): string {
    const noteNames = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
    const octave = Math.floor(pitch / 12) - 1;
    const note = noteNames[pitch % 12];
    return `${note}${octave}`;
  }

/**
 * Adjusts the octave of all harmony notes based on the lowest melody note.
 * Ensures the highest harmony note is no more than an octave below the lowest melody note.
 */
function adjustHarmonyOctaveRelativeToMelody(chords: Chord[]): void {
  const allNotes = flattenChordsToNotes(chords); // Use existing flatten function

  const melodyNotes = allNotes.filter(note => note.voice === 0);
  const harmonyNotes = allNotes.filter(note => note.voice !== undefined && note.voice !== 0);

  // If no melody or no harmony, nothing to adjust
  if (melodyNotes.length === 0 || harmonyNotes.length === 0) {
    return;
  }

  const minMelodyPitch = Math.min(...melodyNotes.map(note => note.pitch));
  const maxHarmonyPitch = Math.max(...harmonyNotes.map(note => note.pitch));

  const gap = minMelodyPitch - maxHarmonyPitch;

  // If the gap is more than an octave (12 semitones)
  if (gap > 12) {
    // Calculate how many octaves to shift up
    // e.g., gap = 13 -> shift 1 octave; gap = 25 -> shift 2 octaves
    const octavesToShift = Math.floor((gap - 1) / 12);
    const pitchAdjustment = octavesToShift * 12;

    if (pitchAdjustment > 0) {
      // Apply the shift to all harmony notes in the original chords structure
      for (const chord of chords) {
        for (const note of chord.notes) {
          // Ensure voice is defined and not the melody voice
          if (note.voice !== undefined && note.voice !== 0) {
            note.pitch += pitchAdjustment;
          }
        }
      }
    }
  }
}
  
// Export the main function and utility
export { optimizeVoiceLeading, pitchToNoteName };