import jsPDF from 'jspdf';
import QRCode from 'qrcode';

class PDFGenerator {
  static TILE_SIZE_CM = 6;
  static TILES_PER_ROW = 3;
  static MARGIN_CM = 1.5;
  static SPACING_CM = 0;
  static PAGE_WIDTH = 21; // A4 width in cm
  static PAGE_HEIGHT = 29.7; // A4 height in cm

  pdf: jsPDF;
  songs: { title: string; artist: string; year: number; spotifyUri: string }[];
  photos: (string | undefined)[];

  gradientColors = [
    [
      [255, 78, 155],
      [58, 141, 255],
    ], // Pink → Blau
    [
      [255, 180, 0],
      [0, 200, 83],
    ], // Orange → Grün
    [
      [156, 39, 176],
      [0, 229, 255],
    ], // Lila → Türkis
    [
      [255, 235, 59],
      [255, 87, 34],
    ], // Gelb → Rot
    [
      [0, 191, 255],
      [255, 0, 128],
    ], // Hellblau → Magenta
    [
      [76, 175, 80],
      [255, 193, 7],
    ], // Grün → Gelb
  ];

  constructor(
    songs: {
      title: string;
      artist: string;
      year: number;
      spotifyUri: string;
    }[],
    photos: (string | undefined)[] = [],
  ) {
    this.songs = songs;
    this.photos = photos;
    this.pdf = new jsPDF({
      putOnlyUsedFonts: true,
      unit: 'cm',
      format: 'a4',
    });
    this.pdf.setFont('helvetica');
    this.pdf.setLanguage('en-US');
  }

  randomIntInclusive(x: number, y: number): number {
    const min = Math.min(x, y);
    const max = Math.max(x, y);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  calculateTilePosition(index: number, isBackSide = false) {
    const row = Math.floor(
      (index % (PDFGenerator.TILES_PER_ROW * 4)) / PDFGenerator.TILES_PER_ROW,
    );
    const col = index % PDFGenerator.TILES_PER_ROW;
    if (!isBackSide) {
      return {
        x:
          PDFGenerator.MARGIN_CM +
          col * (PDFGenerator.TILE_SIZE_CM + PDFGenerator.SPACING_CM),
        y:
          PDFGenerator.MARGIN_CM +
          row * (PDFGenerator.TILE_SIZE_CM + PDFGenerator.SPACING_CM),
      };
    } else {
      const backRow = Math.floor(index / PDFGenerator.TILES_PER_ROW);
      const backCol =
        PDFGenerator.TILES_PER_ROW - 1 - (index % PDFGenerator.TILES_PER_ROW);
      return {
        x:
          PDFGenerator.MARGIN_CM +
          backCol * (PDFGenerator.TILE_SIZE_CM + PDFGenerator.SPACING_CM),
        y:
          PDFGenerator.MARGIN_CM +
          backRow * (PDFGenerator.TILE_SIZE_CM + PDFGenerator.SPACING_CM),
      };
    }
  }

  drawTileBorder(x: number, y: number) {
    this.pdf.setLineWidth(0.01);
    this.pdf.setDrawColor(0);
    this.pdf.rect(x, y, PDFGenerator.TILE_SIZE_CM, PDFGenerator.TILE_SIZE_CM);
  }

  addBackgroundPhoto(x: number, y: number) {
    if (this.photos.length > 0) {
      const randomIndex = this.randomIntInclusive(0, this.photos.length - 1);
      const photo = this.photos[randomIndex];
      if (photo) {
        this.pdf.addImage(
          photo,
          'JPEG',
          x,
          y,
          PDFGenerator.TILE_SIZE_CM,
          PDFGenerator.TILE_SIZE_CM,
          undefined,
          'FAST',
        );
      }
    }
  }

  async generateAndAddQRCode(
    song: { spotifyUri: string },
    x: number,
    y: number,
    shrink = false,
  ) {
    try {
      const spotifyUrl = song.spotifyUri.replace(
        'spotify:track:',
        'https://open.spotify.com/track/',
      );
      const qrDataUrl = await QRCode.toDataURL(spotifyUrl, {
        width: PDFGenerator.TILE_SIZE_CM * 28.35,
        margin: 1,
      });
      const offset = shrink ? 0.8 : 4.2;
      const size = PDFGenerator.TILE_SIZE_CM - (shrink ? 1.6 : 4.6);
      this.pdf.addImage(qrDataUrl, 'PNG', x + offset, y + offset, size, size);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  }

  addPageLink() {
    this.pdf.setFontSize(8);
    this.pdf.setTextColor(100);
    this.pdf.text(
      'generate.blindsongscanner.com',
      PDFGenerator.PAGE_WIDTH / 2,
      PDFGenerator.PAGE_HEIGHT - 0.5,
      {
        align: 'center',
      },
    );
    this.pdf.setTextColor(0);
  }

  drawGradientBackground(x: number, y: number, gradientIndex: number) {
    const gradients = this.gradientColors;
    const idx = gradientIndex % gradients.length;
    const [startRGB, endRGB] = gradients[idx];
    const steps = 20;
    const overlap = (PDFGenerator.TILE_SIZE_CM / steps) * 0.4;
    for (let i = 0; i < steps; i++) {
      const ratio = i / (steps - 1);
      const r = Math.round(startRGB[0] * (1 - ratio) + endRGB[0] * ratio);
      const g = Math.round(startRGB[1] * (1 - ratio) + endRGB[1] * ratio);
      const b = Math.round(startRGB[2] * (1 - ratio) + endRGB[2] * ratio);
      this.pdf.setFillColor(r, g, b);
      this.pdf.rect(
        x,
        y + ratio * PDFGenerator.TILE_SIZE_CM - overlap / 2,
        PDFGenerator.TILE_SIZE_CM,
        PDFGenerator.TILE_SIZE_CM / steps + overlap,
        'F',
      );
    }
  }

  async generatePDF() {
    for (
      let currentSongIndex = 0;
      currentSongIndex < this.songs.length;
      currentSongIndex++
    ) {
      const song = this.songs[currentSongIndex];
      const { x, y } = this.calculateTilePosition(currentSongIndex);
      if (
        currentSongIndex > 0 &&
        currentSongIndex % (PDFGenerator.TILES_PER_ROW * 4) === 0
      ) {
        this.pdf.addPage();
      }
      if (currentSongIndex % (PDFGenerator.TILES_PER_ROW * 4) === 0) {
        this.addPageLink();
      }
      // Gradient-Hintergrund für Vorderseite, mit wechselndem Verlauf
      this.drawGradientBackground(x, y, currentSongIndex);
      this.drawTileBorder(x, y);
      // Weiße Schrift
      this.pdf.setTextColor(255, 255, 255);
      this.pdf.setFontSize(12);
      this.pdf.text(song.artist, x + 3, y + 1, {
        maxWidth: PDFGenerator.TILE_SIZE_CM - 0.5,
        align: 'center',
      });
      this.pdf.setFontSize(14);
      this.pdf.text(song.title, x + 3, y + 3, {
        maxWidth: PDFGenerator.TILE_SIZE_CM - 0.5,
        align: 'center',
      });
      this.pdf.setFontSize(18);
      this.pdf.text(String(song.year || ''), x + 3, y + 5.3, {
        maxWidth: PDFGenerator.TILE_SIZE_CM - 0.5,
        align: 'center',
      });
      this.pdf.setTextColor(0, 0, 0); // Rücksetzen für andere Seiten
      // Back side (even pages)
      if (
        currentSongIndex % (PDFGenerator.TILES_PER_ROW * 4) ===
        PDFGenerator.TILES_PER_ROW * 4 - 1
      ) {
        this.pdf.addPage();
        await this.addQrCodes(currentSongIndex);
      }
    }
    // Add final back page if needed
    if (this.songs.length % (PDFGenerator.TILES_PER_ROW * 4) !== 0) {
      this.pdf.addPage();
      const remainingTiles =
        this.songs.length % (PDFGenerator.TILES_PER_ROW * 4);
      const lastPageIndex = Math.floor(
        (this.songs.length - 1) / (PDFGenerator.TILES_PER_ROW * 4),
      );
      for (let j = 0; j < remainingTiles; j++) {
        const songIndex = lastPageIndex * (PDFGenerator.TILES_PER_ROW * 4) + j;
        await this.addQrCodes(songIndex);
      }
    }
    this.addPageLink();
    return this.pdf;
  }

  private async addQrCodes(currentSongIndex: number) {
    const backPageIndex = Math.floor(
      currentSongIndex / (PDFGenerator.TILES_PER_ROW * 4),
    );
    for (let j = 0; j < PDFGenerator.TILES_PER_ROW * 4; j++) {
      const songIndex = backPageIndex * (PDFGenerator.TILES_PER_ROW * 4) + j;
      if (songIndex >= this.songs.length) break;
      const { x: backX, y: backY } = this.calculateTilePosition(j, true);
      this.addBackgroundPhoto(backX, backY);
      this.drawTileBorder(backX, backY);
      await this.generateAndAddQRCode(this.songs[songIndex], backX, backY);
    }
  }
}

export async function generatePDF(
  songs: { title: string; artist: string; year: number; spotifyUri: string }[],
  photos: (string | undefined)[] = [],
) {
  const generator = new PDFGenerator(songs, photos);
  return await generator.generatePDF();
}
