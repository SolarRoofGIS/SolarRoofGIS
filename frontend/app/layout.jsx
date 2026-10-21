import "./globals.css";

export const metadata = {
  title: "SolarRoofGIS",
  description: "Solar rooftop potential in Bogor",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
