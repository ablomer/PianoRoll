import { useContext, useState, useEffect } from "react";
import { NotesContext } from "../../utils/context";
import { optimizeHarmony } from "../../utils/util-functions";
import { BsLayoutWtf } from "react-icons/bs";
import { NoteData } from "../../utils/types";

interface OptimizeHarmonyButtonProps {
  label?: string;
}

export const OptimizeHarmonyButton = ({ label = "Optimize Harmony" }: OptimizeHarmonyButtonProps): JSX.Element => {
  const { notes, setNotes } = useContext(NotesContext);
  const [compactMode, setCompactMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Check viewport width to determine if compact mode is needed
  useEffect(() => {
    const checkWidth = () => {
      setCompactMode(window.innerWidth < 1024);
    };
    
    checkWidth(); // Initial check
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // Auto-hide message after a delay
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleOptimizeHarmony = () => {
    // Prevent multiple clicks
    if (isOptimizing) return;
    
    setIsOptimizing(true);
    
    try {
      if (notes.notes.length <= 2) {
        setMessage("Need at least 3 notes to optimize");
        setIsOptimizing(false);
        return;
      }
      
      // Check if there's a melody and bass to work with
      const sortedByRow = [...notes.notes].sort((a, b) => a.row - b.row);
      const highestRow = sortedByRow[0].row;
      const lowestRow = sortedByRow[sortedByRow.length - 1].row;
      const innerVoices = notes.notes.filter((note: NoteData) => note.row !== highestRow && note.row !== lowestRow);
      
      if (innerVoices.length === 0) {
        setMessage("Need inner voices to optimize");
        setIsOptimizing(false);
        return;
      }
      
      // Store the original notes for comparison
      const originalNotes = notes.notes.map((note: NoteData) => ({...note}));
      
      // Get optimized notes
      const optimizedNotes = optimizeHarmony(notes.notes);
      
      // Check if optimization changed anything
      let changed = false;
      for (let i = 0; i < originalNotes.length; i++) {
        if (originalNotes[i].note !== optimizedNotes[i].note) {
          changed = true;
          break;
        }
      }
      
      if (!changed) {
        setMessage("No better arrangement found");
        setIsOptimizing(false);
        return;
      }
      
      // Create a new object to trigger state update
      const updatedNotes = {
        ...notes,
        notes: optimizedNotes
      };
      
      // Update state with optimized notes
      setNotes(updatedNotes);
      setMessage("Harmony optimized ✓");
    } catch (err) {
      setMessage("Error optimizing harmony");
      console.error(err);
    }
    
    setIsOptimizing(false);
  };

  return (
    <div className="relative">
      <div
        onClick={handleOptimizeHarmony}
        className={`flex items-center justify-center ${compactMode ? 'w-8 h-8' : 'px-3 py-1'} ml-2 text-sm text-white bg-purple-500 rounded-md hover:bg-purple-600 cursor-pointer ${isOptimizing ? 'opacity-70' : ''}`}
        title="Minimize the distance between consecutive notes while keeping melody and bass fixed"
      >
        <BsLayoutWtf className={`${compactMode ? 'w-5 h-5' : 'w-4 h-4 mr-1'}`} />
        {!compactMode && label}
      </div>
      
      {message && (
        <div className="absolute top-full left-0 mt-1 px-2 py-1 text-xs bg-gray-800 text-white rounded z-50 whitespace-nowrap">
          {message}
        </div>
      )}
    </div>
  );
}; 