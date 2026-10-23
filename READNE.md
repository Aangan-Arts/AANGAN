Add the new product with the name "Date_number(e.g. 20261022_1000)" and add the .jpg file in the Products/web folder and ad the .json file with same name in the Products folder.
For existing products replace with the same name.

for price and MRP -> Price should be our decided price to sell and calculate the MRP by this formula = price / 0.8

once addded all product, open terminal

execute the following command:

cd Projects/Aangan
node tools/build-products.js
git add .
git commit -m "Updated Products"
git push
