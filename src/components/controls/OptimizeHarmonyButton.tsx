import { useState } from "react";
import { PiMusicNotesFill } from "react-icons/pi";
import { OptimizeHarmonyDialog } from "./OptimizeHarmonyDialog";

export const OptimizeHarmonyButton = (): JSX.Element => {
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  return (
    <>
      <div
        className="flex items-center justify-center w-8 h-8 mx-2 bg-purple-500 rounded-md hover:bg-purple-600 cursor-pointer"
        onClick={handleOpenDialog}
        title="Optimize Voice Leading"
      >
        <PiMusicNotesFill color="white" className="w-5 h-5" />
      </div>
      <OptimizeHarmonyDialog open={dialogOpen} onClose={handleCloseDialog} />
    </>
  );
}; 