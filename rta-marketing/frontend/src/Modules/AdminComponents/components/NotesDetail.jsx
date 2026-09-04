import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import { Download, X } from "lucide-react";
import React from "react";

const NotesDetail = ({ open, close, note }) => {
  return (
    <div>
      <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
        <DialogTitle className="flex justify-between items-center">
          <div>
            <Typography variant="h5" component="h2" fontWeight="bold">
              Rejection Note{" "}
            </Typography>
          </div>
          <IconButton onClick={close} size="small">
            <X />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Typography variant="body2" color="textPrimary">
            {note}
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              // console.log("Download clicked");
              close();
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default NotesDetail;
