public class GreatestOfThree {
    public static void main(String[] args) {

        int a = 25;
        int b = 40;
        int c = 15;

        if (a >= b && a >= c) {
            System.out.println("Greatest number is: " + a);
        } 
        else if (b >= a && b >= c) {
            System.out.println("Greatest number is: " + b);
        } 
        else {
            System.out.println("Greatest number is: " + c);
        }
    }
}
